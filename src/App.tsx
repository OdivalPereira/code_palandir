import React, { useState, useRef, useEffect } from 'react';
import CodeVisualizer from './components/CodeVisualizer';
import PromptBuilder from './components/PromptBuilder';
import { IntentPanel } from './components/IntentPanel';
import { TemplateSidebar, BackendTemplate } from './components/TemplateSidebar';
import { TemplateWizard } from './components/TemplateWizard';
import ModuleRecommendations from './components/ModuleRecommendations';
import { analyzeFileContent, findRelevantFiles, PROJECT_SUMMARY_PROMPT_BASE, summarizeProject } from './geminiService';
import { getCachedFileContent, hashContent, setCachedFileContent } from './cacheRepository';
import { fetchGitHubJson } from './githubClient';
import { FileSystemNode, PromptItem, AppStatus, CodeNode, SESSION_SCHEMA_VERSION, SessionPayload, ProjectGraphInput, ProjectSummary, ModuleInput, SemanticLink, Link, MissingDependency, AiMetricsResponse, FlatNode } from './types';
import { Search, FolderOpen, Github, Loader2, Sparkles, FileText, Plus, Save, Network, Lightbulb, Route, BarChart3 } from 'lucide-react';
import { useGraphStore } from './stores/graphStore';
import { selectGraphLinks, selectGraphNodes, selectLoadingPaths, selectRootNode, selectSelectedNode } from './stores/graphSelectors';
import { openSession, saveSession } from './sessionService';
import { buildSemanticLinksForFile, SymbolIndex } from './dependencyParser';
import { usePresenceStore } from './stores/presenceStore';
import { createRealtimeClient } from './realtimeClient';

const LAST_SESSION_STORAGE_KEY = 'codemind:lastSession';
const analysisCacheTtlEnv = Number(import.meta.env.VITE_ANALYSIS_CACHE_TTL_MS ?? '0');
const analysisCacheTtlMs = Number.isFinite(analysisCacheTtlEnv) && analysisCacheTtlEnv > 0
    ? analysisCacheTtlEnv
    : undefined;
const relevantCacheTtlEnv = Number(import.meta.env.VITE_RELEVANT_FILES_CACHE_TTL_MS ?? '0');
const relevantCacheTtlMs = Number.isFinite(relevantCacheTtlEnv) && relevantCacheTtlEnv > 0
    ? relevantCacheTtlEnv
    : undefined;

const App: React.FC = () => {
    const [fileMap, setFileMap] = useState<Map<string, string>>(new Map());
    const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [wizardTemplate, setWizardTemplate] = useState<BackendTemplate | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'prompt' | 'summary' | 'recommendations' | 'flow' | 'metrics'>('prompt');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [projectSignature, setProjectSignature] = useState<string | null>(null);
    const [summaryPromptBase, setSummaryPromptBase] = useState(PROJECT_SUMMARY_PROMPT_BASE);
    const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
    const [summaryStatus, setSummaryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [aiMetrics, setAiMetrics] = useState<AiMetricsResponse | null>(null);
    const [aiMetricsStatus, setAiMetricsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [aiMetricsError, setAiMetricsError] = useState<string | null>(null);
    const [moduleInputs, setModuleInputs] = useState<ModuleInput[]>([]);
    const [flowSourceId, setFlowSourceId] = useState('');
    const [flowTargetId, setFlowTargetId] = useState('');
    const [flowPathNodeIds, setFlowPathNodeIds] = useState<string[] | null>(null);

    const rootNode = useGraphStore(selectRootNode);
    const selectedNode = useGraphStore(selectSelectedNode);
    const loadingPaths = useGraphStore(selectLoadingPaths);
    const graphNodes = useGraphStore(selectGraphNodes);
    const graphLinks = useGraphStore(selectGraphLinks);
    const setRootNode = useGraphStore((state) => state.setRootNode);
    const updateRootNode = useGraphStore((state) => state.updateRootNode);
    const setHighlightedPaths = useGraphStore((state) => state.setHighlightedPaths);
    const setLoadingPaths = useGraphStore((state) => state.setLoadingPaths);
    const setSelectedNode = useGraphStore((state) => state.setSelectedNode);
    const setRequestExpandNode = useGraphStore((state) => state.setRequestExpandNode);
    const setGhostNodes = useGraphStore((state) => state.setGhostNodes);
    const setMissingDependencies = useGraphStore((state) => state.setMissingDependencies);
    const restoreSession = useGraphStore((state) => state.restoreSession);
    const setSessionLayout = useGraphStore((state) => state.setSessionLayout);
    const graphNodesById = useGraphStore((state) => state.nodesById);
    const graphLinksById = useGraphStore((state) => state.linksById);
    const semanticLinksById = useGraphStore((state) => state.semanticLinksById);
    const graphViewMode = useGraphStore((state) => state.graphViewMode);
    const setSemanticLinks = useGraphStore((state) => state.setSemanticLinks);
    const setGraphViewMode = useGraphStore((state) => state.setGraphViewMode);
    const setFlowQuery = useGraphStore((state) => state.setFlowQuery);
    const setFlowHighlight = useGraphStore((state) => state.setFlowHighlight);
    const clearFlowHighlight = useGraphStore((state) => state.clearFlowHighlight);
    const selectedNodeId = useGraphStore((state) => state.selectedNodeId);

    const presenceClientId = usePresenceStore((state) => state.clientId);
    const presenceProfile = usePresenceStore((state) => state.profile);
    const localCursor = usePresenceStore((state) => state.localCursor);
    const localSelection = usePresenceStore((state) => state.localSelection);
    const setLocalSelection = usePresenceStore((state) => state.setLocalSelection);
    const setPeers = usePresenceStore((state) => state.setPeers);
    const updatePeer = usePresenceStore((state) => state.updatePeer);
    const removePeer = usePresenceStore((state) => state.removePeer);
    const setConnectionStatus = usePresenceStore((state) => state.setConnectionStatus);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const childrenIndexRef = useRef<Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>>(new Map());
    const descendantCountRef = useRef<Map<string, number>>(new Map());
    const localFileHandlesRef = useRef<Map<string, File>>(new Map());
    const allFilePathsRef = useRef<string[]>([]);
    const autoRestoreSignatureRef = useRef<string | null>(null);
    const realtimeClientRef = useRef<ReturnType<typeof createRealtimeClient> | null>(null);

    const flowNodeOptions = React.useMemo(() => {
        const options = graphNodes.map((node) => ({
            id: node.id,
            label: node.path ? `${node.name} (${node.path})` : node.name
        }));
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }, [graphNodes]);

    const flowBreadcrumbs = React.useMemo(() => {
        if (!flowPathNodeIds || flowPathNodeIds.length === 0) return [];
        return flowPathNodeIds.map((id) => {
            const node = graphNodesById[id];
            return {
                id,
                label: node?.name ?? id,
                detail: node?.path ?? id
            };
        });
    }, [flowPathNodeIds, graphNodesById]);

    const realtimeSessionId = sessionId ?? projectSignature ?? null;

    useEffect(() => {
        setLocalSelection(selectedNodeId ?? null);
    }, [selectedNodeId, setLocalSelection]);

    useEffect(() => {
        if (!realtimeSessionId) {
            realtimeClientRef.current?.close();
            realtimeClientRef.current = null;
            return;
        }

        realtimeClientRef.current?.close();
        try {
            realtimeClientRef.current = createRealtimeClient({
                sessionId: realtimeSessionId,
                clientId: presenceClientId,
                profile: presenceProfile,
                onStateSync: (presence) => {
                    const peers = presence.filter((entry) => entry.clientId !== presenceClientId);
                    setPeers(peers);
                },
                onPresenceUpdate: (presence) => {
                    if (presence.clientId === presenceClientId) return;
                    updatePeer(presence);
                },
                onPresenceRemove: (clientId) => {
                    if (clientId === presenceClientId) return;
                    removePeer(clientId);
                },
                onConnectionChange: (status) => {
                    setConnectionStatus(status);
                }
            });
        } catch (error) {
            console.error('Failed to create realtime client', error);
            setConnectionStatus('disconnected');
        }

        return () => {
            realtimeClientRef.current?.close();
            realtimeClientRef.current = null;
        };
    }, [presenceClientId, presenceProfile, realtimeSessionId, removePeer, setConnectionStatus, setPeers, updatePeer]);

    useEffect(() => {
        if (!realtimeSessionId || !realtimeClientRef.current) return;
        realtimeClientRef.current.sendPresenceUpdate({
            cursor: localCursor,
            selection: localSelection
        });
    }, [localCursor, localSelection, realtimeSessionId]);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        }).format(value);

    const formatPercent = (value: number) =>
        `${(value * 100).toFixed(1)}%`;

    const refreshAiMetrics = async () => {
        setAiMetricsStatus('loading');
        setAiMetricsError(null);
        try {
            const response = await fetch('/api/ai/metrics', { credentials: 'include' });
            if (!response.ok) {
                throw new Error('Falha ao carregar métricas.');
            }
            const payload = await response.json() as AiMetricsResponse;
            setAiMetrics(payload);
            setAiMetricsStatus('idle');
        } catch (error) {
            console.error(error);
            setAiMetricsStatus('error');
            setAiMetricsError(error instanceof Error ? error.message : 'Falha ao carregar métricas.');
        }
    };

    useEffect(() => {
        if (!isPromptOpen || sidebarTab !== 'metrics') return;
        refreshAiMetrics();
    }, [isPromptOpen, sidebarTab]);

    const loadStoredSessionMeta = () => {
        if (typeof window === 'undefined') return null;
        const raw = window.localStorage.getItem(LAST_SESSION_STORAGE_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as { sessionId?: string; projectSignature?: string };
            if (parsed?.sessionId && parsed?.projectSignature) {
                return { sessionId: parsed.sessionId, projectSignature: parsed.projectSignature };
            }
        } catch {
            return null;
        }
        return null;
    };

    const storeSessionMeta = (nextSessionId: string, signature: string | null) => {
        if (typeof window === 'undefined' || !signature) return;
        window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify({
            sessionId: nextSessionId,
            projectSignature: signature
        }));
    };

    const computeProjectSignature = async (paths: string[], sourceId: string) => {
        const normalized = [...paths].sort().join('|');
        return hashContent(`${sourceId}::${normalized}`);
    };

    const restoreSessionById = async (
        requestedId: string,
        signatureOverride?: string | null
    ) => {
        const response = await openSession(requestedId.trim());
        restoreSession(response.session.graph, response.session.selection);
        setPromptItems(response.session.prompts);
        setSessionId(response.sessionId);
        setSessionLayout(
            response.session.layout
                ? { hash: response.session.layout.graphHash, positions: response.session.layout.positions }
                : null
        );
        setFileMap(new Map());
        setStatus(AppStatus.IDLE);
        storeSessionMeta(response.sessionId, signatureOverride ?? projectSignature);
    };

    const tryRestoreSavedSession = async (signature: string) => {
        if (autoRestoreSignatureRef.current === signature) return;
        autoRestoreSignatureRef.current = signature;
        const stored = loadStoredSessionMeta();
        if (!stored || stored.projectSignature !== signature) return;
        try {
            await restoreSessionById(stored.sessionId, signature);
        } catch (error) {
            console.error(error);
        }
    };

    // --- File Loading Logic ---

    const buildChildrenIndex = (paths: string[]) => {
        const index = new Map<string, Map<string, { path: string; name: string; type: 'directory' | 'file' }>>();

        const addChild = (parentPath: string, entry: { path: string; name: string; type: 'directory' | 'file' }) => {
            const bucket = index.get(parentPath) ?? new Map();
            bucket.set(entry.path, entry);
            index.set(parentPath, bucket);
        };

        paths.forEach((path) => {
            const parts = path.split('/');
            for (let i = 0; i < parts.length; i++) {
                const name = parts[i];
                const isFile = i === parts.length - 1;
                const entryPath = parts.slice(0, i + 1).join('/');
                const parentPath = i === 0 ? '' : parts.slice(0, i).join('/');
                addChild(parentPath, { path: entryPath, name, type: isFile ? 'file' : 'directory' });
            }
        });

        const normalizedIndex = new Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>();
        index.forEach((bucket, parentPath) => {
            normalizedIndex.set(parentPath, Array.from(bucket.values()));
        });
        return normalizedIndex;
    };

    const computeDescendantCounts = (index: Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>) => {
        const cache = new Map<string, number>();
        const countDescendants = (path: string): number => {
            if (cache.has(path)) {
                return cache.get(path)!;
            }
            const children = index.get(path) ?? [];
            let total = 0;
            for (const child of children) {
                total += 1;
                if (child.type === 'directory') {
                    total += countDescendants(child.path);
                }
            }
            cache.set(path, total);
            return total;
        };
        for (const key of index.keys()) {
            countDescendants(key);
        }
        return cache;
    };

    const buildChildNodes = (parentPath: string) => {
        const entries = (childrenIndexRef.current.get(parentPath) ?? []).slice();
        entries.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return entries.map((entry) => ({
            id: entry.path,
            name: entry.name,
            type: entry.type,
            path: entry.path,
            hasChildren: entry.type === 'directory' ? (childrenIndexRef.current.get(entry.path)?.length ?? 0) > 0 : false,
            descendantCount: descendantCountRef.current.get(entry.path) ?? 0,
            children: undefined
        }));
    };

    const processFiles = async (files: FileList) => {
        setStatus(AppStatus.LOADING_FILES);
        const newFileHandles = new Map<string, File>();
        const allPaths: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.webkitRelativePath.includes('/.') || file.name.startsWith('.')) continue;
            newFileHandles.set(file.webkitRelativePath, file);
            allPaths.push(file.webkitRelativePath);
        }

        const childrenIndex = buildChildrenIndex(allPaths);
        childrenIndexRef.current = childrenIndex;
        descendantCountRef.current = computeDescendantCounts(childrenIndex);
        localFileHandlesRef.current = newFileHandles;
        allFilePathsRef.current = allPaths;

        const rootChildren = buildChildNodes('');
        const root: FileSystemNode = {
            id: 'root',
            name: 'Project Root',
            type: 'directory',
            path: '',
            children: rootChildren,
            hasChildren: rootChildren.length > 0,
            descendantCount: descendantCountRef.current.get('') ?? rootChildren.length
        };

        setFileMap(new Map());
        setRootNode(root);
        setModuleInputs([]);
        setStatus(AppStatus.IDLE);
        setSessionLayout(null);

        const signature = await computeProjectSignature(allPaths, 'local');
        setProjectSignature(signature);
        await tryRestoreSavedSession(signature);
    };

    const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    };

    const handleGithubImport = async () => {
        if (!githubUrl) return;
        setStatus(AppStatus.LOADING_FILES);

        try {
            // Parse URL: https://github.com/owner/repo
            const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (!match) throw new Error("Invalid GitHub URL");
            const [_, owner, repo] = match;

            // Fetch tree (recursive)
            const treeData = await fetchGitHubJson<{ tree: { type: string; path: string }[] }>(
                `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
            );

            const paths = treeData.tree.filter((item: { type: string }) => item.type === 'blob').map((item: { path: string }) => item.path);
            const childrenIndex = buildChildrenIndex(paths);
            childrenIndexRef.current = childrenIndex;
            descendantCountRef.current = computeDescendantCounts(childrenIndex);
            allFilePathsRef.current = paths;
            localFileHandlesRef.current = new Map();

            const rootChildren = buildChildNodes('');
            const root: FileSystemNode = {
                id: 'root',
                name: repo,
                type: 'directory',
                path: '',
                children: rootChildren,
                hasChildren: rootChildren.length > 0,
                descendantCount: descendantCountRef.current.get('') ?? rootChildren.length
            };

            setRootNode(root);
            setFileMap(new Map());
            setModuleInputs([]);
            setStatus(AppStatus.IDLE);
            setSessionLayout(null);

            const signature = await computeProjectSignature(paths, `github:${owner}/${repo}`);
            setProjectSignature(signature);
            await tryRestoreSavedSession(signature);

        } catch (error) {
            console.error(error);
            alert("Error importing from GitHub. Ensure it's a public repo.");
            setStatus(AppStatus.ERROR);
        }
    };

    // --- AI Logic ---

    const handleSearch = async () => {
        if (!searchQuery.trim() || !rootNode) return;
        setStatus(AppStatus.ANALYZING_QUERY);

        const allPaths = allFilePathsRef.current.length > 0 ? allFilePathsRef.current : [];

        try {
            const relevantPaths = await findRelevantFiles(searchQuery, allPaths, { ttlMs: relevantCacheTtlMs });
            setHighlightedPaths(relevantPaths);

            // Add context
            setPromptItems(prev => [...prev, {
                id: Date.now().toString(),
                title: "Goal",
                content: searchQuery,
                type: 'context'
            }]);

            setStatus(AppStatus.IDLE);
        } catch (error) {
            console.error(error);
            setStatus(AppStatus.ERROR);
        }
    };

    const ensureFileContent = async (path: string) => {
        let content = fileMap.get(path);

        if (!content && localFileHandlesRef.current.size > 0) {
            const localFile = localFileHandlesRef.current.get(path);
            if (localFile) {
                content = await localFile.text();
                setFileMap(prev => new Map(prev).set(path, content!));
            }
        }

        if (!content && githubUrl) {
            const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
            if (match) {
                const [_, owner, repo] = match;
                try {
                    const cacheKey = await hashContent(`file-content:${owner}/${repo}:${path}`);
                    const cached = await getCachedFileContent(cacheKey);
                    if (cached?.content) {
                        content = cached.content;
                        setFileMap(prev => new Map(prev).set(path, content!));
                        return content;
                    }

                    const data = await fetchGitHubJson<{ content?: string }>(
                        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
                    );
                    if (data.content) {
                        content = atob(data.content);
                        await setCachedFileContent(cacheKey, content);
                        setFileMap(prev => new Map(prev).set(path, content!));
                    }
                } catch (e) {
                    console.error("Failed to fetch file content", e);
                }
            }
        }

        if (content) {
            const existingStructure = findCodeStructureForPath(path);
            updateSemanticEdgesForFile(path, content, existingStructure);
        }
        return content;
    };

    const handleExpandNode = (path: string) => {
        if (!rootNode) return;
        if (!childrenIndexRef.current.has(path)) return;
        if (loadingPaths.has(path)) return;

        const updateTree = (node: FileSystemNode): FileSystemNode => {
            if (node.path === path) {
                if (node.children && node.children.length > 0) {
                    return node;
                }
                const nextChildren = buildChildNodes(path);
                return { ...node, children: nextChildren };
            }
            if (!node.children) return node;
            return {
                ...node,
                children: node.children.map(child => updateTree(child))
            };
        };

        setLoadingPaths(new Set([...loadingPaths, path]));
        updateRootNode((prev) => (prev ? updateTree(prev) : prev));
        window.setTimeout(() => {
            const currentLoading = useGraphStore.getState().loadingPaths;
            const next = new Set(currentLoading);
            next.delete(path);
            setLoadingPaths(next);
        }, 250);
    };

    useEffect(() => {
        setRequestExpandNode(() => handleExpandNode);
        return () => setRequestExpandNode(null);
    }, [handleExpandNode, setRequestExpandNode]);

    useEffect(() => {
        if (!selectedNode || selectedNode.type !== 'file') return;
        let isActive = true;
        const analyzeSelectedFile = async () => {
            const content = await ensureFileContent(selectedNode.path);
            if (!content || !isActive) return;
            const updateTree = (n: FileSystemNode): boolean => {
                if (n.path === selectedNode.path) {
                    if (!n.codeStructure) {
                        setStatus(AppStatus.ANALYZING_QUERY);
                        analyzeFileContent(content, n.name, { ttlMs: analysisCacheTtlMs }).then(structure => {
                            if (!isActive) return;
                            n.codeStructure = structure;
                            updateRootNode(prev => (prev ? { ...prev } : null));
                            updateSemanticEdgesForFile(selectedNode.path, content, structure);
                            setStatus(AppStatus.IDLE);
                        });
                    }
                    return true;
                }
                if (n.children) {
                    for (const child of n.children) {
                        if (updateTree(child)) return true;
                    }
                }
                return false;
            };
            if (rootNode) updateTree(rootNode);
        };
        analyzeSelectedFile();
        return () => {
            isActive = false;
        };
    }, [rootNode, selectedNode, updateRootNode]);

    useEffect(() => {
        setFlowQuery(flowSourceId || null, flowTargetId || null);
        if (!flowSourceId || !flowTargetId) {
            setFlowPathNodeIds(null);
            clearFlowHighlight();
            return;
        }
        if (flowSourceId === flowTargetId) {
            setFlowPathNodeIds([]);
            clearFlowHighlight();
            return;
        }
        const nodeIds = new Set(graphNodes.map((node) => node.id));
        const path = buildFlowPath(flowSourceId, flowTargetId, graphLinks, nodeIds);
        if (!path) {
            setFlowPathNodeIds([]);
            clearFlowHighlight();
            return;
        }
        setFlowHighlight(path.nodeIds, path.linkIds);
        setFlowPathNodeIds(path.nodeIds);
    }, [flowSourceId, flowTargetId, graphLinks, graphNodes, setFlowQuery, setFlowHighlight, clearFlowHighlight]);

    const addToPrompt = (title: string, content: string) => {
        setPromptItems(prev => [...prev, {
            id: Date.now().toString(),
            title,
            content,
            type: 'code'
        }]);
        setIsPromptOpen(true);
        setSidebarTab('prompt');
    };

    function buildSymbolIndex() {
        const index: SymbolIndex = new Map();
        Object.values(useGraphStore.getState().nodesById).forEach((node) => {
            if (node.type === 'function' || node.type === 'class' || node.type === 'variable' || node.type === 'api_endpoint') {
                const existing = index.get(node.name) ?? [];
                existing.push(node.id);
                index.set(node.name, existing);
            }
        });
        return index;
    }

    function updateSemanticEdgesForFile(
        path: string,
        content: string,
        codeStructure?: CodeNode[]
    ) {
        const filePaths = new Set(allFilePathsRef.current);
        if (filePaths.size === 0) return;
        const symbolIndex = buildSymbolIndex();
        const { links, sourceIds } = buildSemanticLinksForFile({
            sourcePath: path,
            content,
            codeStructure,
            filePaths,
            symbolIndex
        });
        const normalizedLinks: SemanticLink[] = links.map((link) => ({
            ...link,
            source: typeof link.source === 'string' ? link.source : link.source.id,
            target: typeof link.target === 'string' ? link.target : link.target.id
        }));
        setSemanticLinks(normalizedLinks, sourceIds);
    }

    function findCodeStructureForPath(path: string) {
        const root = useGraphStore.getState().rootNode;
        const walk = (node: FileSystemNode | null): CodeNode[] | undefined => {
            if (!node) return undefined;
            if (node.path === path) return node.codeStructure;
            if (!node.children) return undefined;
            for (const child of node.children) {
                const result = walk(child);
                if (result) return result;
            }
            return undefined;
        };
        return walk(root);
    }

    const getLinkId = (link: Link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return link.kind ? `${link.kind}:${sourceId}-->${targetId}` : `${sourceId}-->${targetId}`;
    };

    const buildFlowPath = (sourceId: string, targetId: string, links: Link[], nodeIds: Set<string>) => {
        if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return null;
        const adjacency = new Map<string, { id: string; linkId: string }[]>();
        const registerEdge = (from: string, to: string, linkId: string) => {
            const neighbors = adjacency.get(from) ?? [];
            neighbors.push({ id: to, linkId });
            adjacency.set(from, neighbors);
        };
        links.forEach((link) => {
            const source = typeof link.source === 'string' ? link.source : link.source.id;
            const target = typeof link.target === 'string' ? link.target : link.target.id;
            const linkId = getLinkId(link);
            registerEdge(source, target, linkId);
            registerEdge(target, source, linkId);
        });
        const queue: string[] = [sourceId];
        const visited = new Set<string>([sourceId]);
        const prevNode = new Map<string, string | null>();
        const prevLink = new Map<string, string | null>();
        prevNode.set(sourceId, null);
        prevLink.set(sourceId, null);

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === targetId) break;
            const neighbors = adjacency.get(current) ?? [];
            neighbors.forEach((neighbor) => {
                if (visited.has(neighbor.id)) return;
                visited.add(neighbor.id);
                prevNode.set(neighbor.id, current);
                prevLink.set(neighbor.id, neighbor.linkId);
                queue.push(neighbor.id);
            });
        }

        if (!visited.has(targetId)) return null;
        const nodePath: string[] = [];
        const linkPath: string[] = [];
        let current: string | null = targetId;
        while (current) {
            nodePath.push(current);
            const linkId = prevLink.get(current);
            if (linkId) {
                linkPath.push(linkId);
            }
            current = prevNode.get(current) ?? null;
        }
        return { nodeIds: nodePath.reverse(), linkIds: linkPath.reverse() };
    };

    const buildProjectGraphInput = (): ProjectGraphInput => {
        const nodes = Object.values(graphNodesById).map(node => ({
            id: node.id,
            type: node.type,
            label: node.name,
            path: node.path
        }));
        const edges = Object.values(graphLinksById).map(link => ({
            source: typeof link.source === 'string' ? link.source : link.source.id,
            target: typeof link.target === 'string' ? link.target : link.target.id
        }));
        return { nodes, edges };
    };

    const handleGenerateSummary = async () => {
        if (!rootNode) return;
        setSummaryStatus('loading');
        setSummaryError(null);
        try {
            const graph = buildProjectGraphInput();
            const context = promptItems
                .filter((item) => item.type !== 'code')
                .map((item) => `${item.title}: ${item.content}`);
            const summary = await summarizeProject({
                filePaths: allFilePathsRef.current,
                graph,
                context,
                promptBase: summaryPromptBase
            });
            setProjectSummary(summary);
            setSummaryStatus('idle');
        } catch (error) {
            console.error(error);
            setSummaryStatus('error');
            setSummaryError('Falha ao gerar resumo. Tente novamente.');
        }
    };

    const buildSessionPayload = (): SessionPayload => {
        const graphState = useGraphStore.getState();
        const layoutCache = graphState.layoutCache;
        return {
            schemaVersion: SESSION_SCHEMA_VERSION,
            graph: {
                rootNode: graphState.rootNode,
                highlightedPaths: graphState.highlightedPaths,
                expandedDirectories: Array.from(graphState.expandedDirectories),
                semanticLinks: Object.values(graphState.semanticLinksById).map((link) => ({
                    source: typeof link.source === 'string' ? link.source : link.source.id,
                    target: typeof link.target === 'string' ? link.target : link.target.id,
                    kind: link.kind
                })),
                graphViewMode: graphState.graphViewMode
            },
            selection: {
                selectedNodeId: graphState.selectedNodeId
            },
            prompts: promptItems,
            layout: layoutCache
                ? {
                    graphHash: layoutCache.hash,
                    positions: layoutCache.positions
                }
                : null
        };
    };

    const handleSaveSession = async () => {
        if (!rootNode) {
            alert('Load a project before saving a session.');
            return;
        }
        try {
            const payload = buildSessionPayload();
            const response = await saveSession(payload, sessionId);
            setSessionId(response.sessionId);
            storeSessionMeta(response.sessionId, projectSignature);
            alert(`Session saved. ID: ${response.sessionId}`);
        } catch (error) {
            console.error(error);
            alert('Failed to save session.');
        }
    };

    const handleOpenSession = async () => {
        const requestedId = window.prompt('Enter session ID to open:', sessionId ?? '');
        if (!requestedId) return;
        try {
            await restoreSessionById(requestedId);
        } catch (error) {
            console.error(error);
            alert('Failed to open session.');
        }
    };

    const handleTemplateSelect = (template: BackendTemplate) => {
        setWizardTemplate(template);
    };

    const handleTemplateDragStart = (template: BackendTemplate, event: React.DragEvent) => {
        event.dataTransfer.setData('template', JSON.stringify(template));
        event.dataTransfer.effectAllowed = 'copy';
    };

    const handleWizardApply = (ghostNodes: FlatNode[], ghostLinks: Link[], deps: MissingDependency[]) => {
        setGhostNodes(ghostNodes, ghostLinks);
        if (deps.length > 0 && ghostNodes.length > 0) {
            // Use null for requirements since this is template-based
            setMissingDependencies(deps, {
                tables: deps.filter(d => d.type === 'table').map(d => ({
                    name: d.name,
                    description: d.description,
                    columns: [],
                })),
                endpoints: deps.filter(d => d.type === 'endpoint').map(d => ({
                    method: 'POST' as const,
                    path: d.name,
                    description: d.description,
                })),
                services: deps.filter(d => d.type === 'service' || d.type === 'auth').map(d => ({
                    name: d.name,
                    type: d.type as 'auth' | 'storage' | 'email' | 'payment' | 'other',
                    description: d.description,
                })),
            });
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">

            {/* Left Sidebar: Backend Templates */}
            <TemplateSidebar
                onTemplateSelect={handleTemplateSelect}
                onTemplateDragStart={handleTemplateDragStart}
                className="w-64"
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative">

                {/* Top Bar */}
                <div className="h-16 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
                            <Sparkles size={20} />
                            <span>CodeMind AI</span>
                        </div>

                        {/* Source Controls */}
                        <div className="flex items-center gap-2 ml-8">
                            <div className="relative group">
                                <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors">
                                    <FolderOpen size={14} /> Local Dir
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    // @ts-ignore
                                    webkitdirectory="" directory="" multiple=""
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleLocalUpload}
                                />
                            </div>
                            <span className="text-slate-600 text-xs">OR</span>
                            <div className="flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
                                <div className="px-2 text-slate-500"><Github size={14} /></div>
                                <input
                                    type="text"
                                    placeholder="github.com/owner/repo"
                                    className="bg-transparent border-none text-sm px-2 py-1.5 w-48 focus:outline-none text-slate-300"
                                    value={githubUrl}
                                    onChange={e => setGithubUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleGithubImport()}
                                />
                                <button onClick={handleGithubImport} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium">Load</button>
                            </div>
                        </div>
                    </div>

                    {/* AI Query Bar */}
                    <div className="flex-1 max-w-xl mx-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Ask AI: 'Where is the user authentication logic?'"
                                className="w-full bg-slate-950 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                            {status === AppStatus.ANALYZING_QUERY && (
                                <div className="absolute right-3 top-2.5">
                                    <Loader2 className="animate-spin text-indigo-400" size={16} />
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setIsPromptOpen((prev) => (prev && sidebarTab === 'prompt' ? false : true));
                            setSidebarTab('prompt');
                        }}
                        className={`p-2 rounded-lg transition-colors relative ${isPromptOpen && sidebarTab === 'prompt' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                    >
                        <FileText size={20} />
                        {promptItems.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                {promptItems.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => {
                            setIsPromptOpen((prev) => (prev && sidebarTab === 'summary' ? false : true));
                            setSidebarTab('summary');
                        }}
                        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'summary' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                        aria-label="Open project summary"
                    >
                        <Network size={20} />
                    </button>
                    <button
                        onClick={() => {
                            setIsPromptOpen((prev) => (prev && sidebarTab === 'flow' ? false : true));
                            setSidebarTab('flow');
                        }}
                        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'flow' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                        aria-label="Open flow query"
                    >
                        <Route size={20} />
                    </button>
                    <button
                        onClick={() => {
                            setIsPromptOpen((prev) => (prev && sidebarTab === 'recommendations' ? false : true));
                            setSidebarTab('recommendations');
                        }}
                        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'recommendations' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                        aria-label="Open module recommendations"
                    >
                        <Lightbulb size={20} />
                    </button>
                    <button
                        onClick={() => {
                            setIsPromptOpen((prev) => (prev && sidebarTab === 'metrics' ? false : true));
                            setSidebarTab('metrics');
                        }}
                        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'metrics' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                        aria-label="Open AI metrics"
                    >
                        <BarChart3 size={20} />
                    </button>

                    <div className="ml-2 flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-full p-1 text-xs">
                            <button
                                onClick={() => setGraphViewMode('structural')}
                                className={`px-3 py-1 rounded-full transition-colors ${graphViewMode === 'structural' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                            >
                                Estrutural
                            </button>
                            <button
                                onClick={() => setGraphViewMode('semantic')}
                                className={`px-3 py-1 rounded-full transition-colors ${graphViewMode === 'semantic' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                            >
                                Semântico
                            </button>
                        </div>
                        <button
                            onClick={handleSaveSession}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
                        >
                            <Save size={14} /> Save Session
                        </button>
                        <button
                            onClick={handleOpenSession}
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
                        >
                            <FolderOpen size={14} /> Open Session
                        </button>
                    </div>
                </div>

                {/* Visualization Area */}
                <div className="flex-1 relative overflow-hidden">
                    {status === AppStatus.LOADING_FILES ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
                            <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
                            <p className="text-slate-400">Parsing project structure...</p>
                        </div>
                    ) : (
                        <CodeVisualizer />
                    )}

                    {/* Selected Node Detail Overlay */}
                    {selectedNode && (
                        <div className="absolute top-4 left-4 w-80 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-xl p-4 max-h-[80%] overflow-y-auto">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-slate-200 break-all">{selectedNode.name}</h3>
                                <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-300">×</button>
                            </div>
                            <div className="text-xs text-slate-400 mb-4 font-mono bg-slate-950 p-1 rounded">{selectedNode.path}</div>

                            {selectedNode.type === 'file' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-300">
                                        {(selectedNode.data as FileSystemNode).codeStructure ?
                                            "Structure analyzed. See graph for children." :
                                            "Click to analyze structure."}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                const content = await ensureFileContent(selectedNode.path);
                                                if (content) addToPrompt(`File: ${selectedNode.name}`, content);
                                            }}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1"
                                        >
                                            <Plus size={14} /> Add File to Prompt
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(selectedNode.type === 'function' || selectedNode.type === 'class') && (
                                <div>
                                    <p className="text-sm text-slate-300 mb-2">{(selectedNode.data as CodeNode).description}</p>
                                    <pre className="text-xs bg-slate-950 p-2 rounded overflow-x-auto mb-3 border border-slate-800">
                                        {(selectedNode.data as CodeNode).codeSnippet}
                                    </pre>
                                    <button
                                        onClick={() => addToPrompt(`${selectedNode.type}: ${selectedNode.name}`, (selectedNode.data as CodeNode).codeSnippet || '')}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1"
                                    >
                                        <Plus size={14} /> Add to Prompt
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar: Intent Panel (Reverse Architect) */}
            <IntentPanel className="w-80" />

            {/* Right Sidebar: Prompt Builder (Collapsible) */}
            <div
                className={`bg-slate-900 border-l border-slate-800 transition-all duration-300 ease-in-out flex flex-col ${isPromptOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full opacity-0'
                    }`}
            >
                <div className="flex-1 overflow-hidden">
                    {sidebarTab === 'prompt' ? (
                        <PromptBuilder
                            items={promptItems}
                            modules={moduleInputs}
                            onRemove={(id) => setPromptItems(prev => prev.filter(i => i.id !== id))}
                            onClear={() => setPromptItems([])}
                        />
                    ) : sidebarTab === 'summary' ? (
                        <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
                            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                                    <Network size={18} className="text-indigo-400" />
                                    Project Summary
                                </h2>
                                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">
                                    {Object.keys(graphNodesById).length} nodes
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wide text-slate-400">Prompt base</label>
                                    <textarea
                                        value={summaryPromptBase}
                                        onChange={(event) => setSummaryPromptBase(event.target.value)}
                                        className="w-full h-40 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="text-xs text-slate-400 space-y-1">
                                    <p>Arquivos carregados: <span className="text-slate-200">{allFilePathsRef.current.length}</span></p>
                                    <p>Conexões do grafo (estrutural): <span className="text-slate-200">{Object.keys(graphLinksById).length}</span></p>
                                    <p>Conexões do grafo (semântico): <span className="text-slate-200">{Object.keys(semanticLinksById).length}</span></p>
                                </div>
                                <button
                                    onClick={handleGenerateSummary}
                                    disabled={!rootNode || summaryStatus === 'loading'}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white py-2.5 rounded-lg font-medium transition-colors"
                                >
                                    {summaryStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    Gerar resumo
                                </button>
                                {summaryError && (
                                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                                        {summaryError}
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">Resumo</h3>
                                        <p className="text-xs text-slate-300 whitespace-pre-wrap">
                                            {projectSummary?.summary || 'Nenhum resumo gerado ainda.'}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">Diagrama lógico (Mermaid)</h3>
                                        <pre className="bg-slate-950 p-2 rounded text-xs text-slate-300 overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                                            {projectSummary?.diagram || 'flowchart TD\n  A[Contexto] --> B[Resumo]\n  B --> C[Mermaid]'}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : sidebarTab === 'flow' ? (
                        <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
                            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                                    <Route size={18} className="text-amber-400" />
                                    Consulta de fluxo
                                </h2>
                                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">
                                    {graphViewMode === 'semantic' ? 'Semântico' : 'Estrutural'}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wide text-slate-400">Entrypoint</label>
                                    <select
                                        value={flowSourceId}
                                        onChange={(event) => setFlowSourceId(event.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Selecione o ponto de entrada</option>
                                        {flowNodeOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wide text-slate-400">Destino</label>
                                    <select
                                        value={flowTargetId}
                                        onChange={(event) => setFlowTargetId(event.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Selecione o destino</option>
                                        {flowNodeOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setFlowSourceId('');
                                            setFlowTargetId('');
                                            setFlowPathNodeIds(null);
                                            clearFlowHighlight();
                                        }}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-2 rounded"
                                    >
                                        Limpar
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-wide text-slate-400">Breadcrumbs</label>
                                    {flowBreadcrumbs.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {flowBreadcrumbs.map((crumb) => (
                                                <div key={crumb.id} className="bg-slate-950 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-200">
                                                    <span className="font-semibold">{crumb.label}</span>
                                                    <span className="text-slate-400 ml-1">{crumb.detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400">
                                            {flowSourceId && flowTargetId
                                                ? flowSourceId === flowTargetId
                                                    ? 'Entrypoint e destino precisam ser diferentes.'
                                                    : 'Nenhum caminho encontrado para a visão atual.'
                                                : 'Defina entrypoint e destino para visualizar o caminho.'}
                                        </p>
                                    )}
                                </div>
                                <div className="text-xs text-slate-300 bg-slate-950 border border-slate-700 rounded p-3">
                                    {flowBreadcrumbs.length > 0
                                        ? `Caminho encontrado com ${flowBreadcrumbs.length} nós e ${flowBreadcrumbs.length - 1} passos.`
                                        : 'A explicação do fluxo aparecerá aqui após definir a consulta.'}
                                </div>
                            </div>
                        </div>
                    ) : sidebarTab === 'metrics' ? (
                        <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
                            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                                    <BarChart3 size={18} className="text-emerald-400" />
                                    Métricas de IA
                                </h2>
                                <button
                                    onClick={refreshAiMetrics}
                                    className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full"
                                >
                                    Atualizar
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {aiMetricsStatus === 'loading' && (
                                    <div className="text-xs text-slate-400 flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin" />
                                        Carregando métricas...
                                    </div>
                                )}
                                {aiMetricsError && (
                                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                                        {aiMetricsError}
                                    </div>
                                )}
                                {aiMetrics && (
                                    <>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                                                <p className="text-xs text-slate-400">Custo total</p>
                                                <p className="text-sm text-slate-100 font-semibold">
                                                    {formatCurrency(aiMetrics.summary.totalCostUsd)}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    Média {formatCurrency(aiMetrics.summary.averageCostUsd)}
                                                </p>
                                            </div>
                                            <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                                                <p className="text-xs text-slate-400">Latência média</p>
                                                <p className="text-sm text-slate-100 font-semibold">
                                                    {aiMetrics.summary.averageLatencyMs.toFixed(0)} ms
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {aiMetrics.summary.totalRequests} chamadas
                                                </p>
                                            </div>
                                            <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                                                <p className="text-xs text-slate-400">Hit rate</p>
                                                <p className="text-sm text-slate-100 font-semibold">
                                                    {formatPercent(aiMetrics.summary.hitRate)}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {aiMetrics.summary.successCount} sucessos
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs uppercase tracking-wide text-slate-400">Últimas chamadas</h3>
                                                <span className="text-[10px] text-slate-500">
                                                    Atualizado {new Date(aiMetrics.summary.lastUpdated).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {aiMetrics.recent.length === 0 ? (
                                                    <p className="text-xs text-slate-500">Nenhuma chamada registrada.</p>
                                                ) : (
                                                    aiMetrics.recent.map((entry) => (
                                                        <div key={entry.id} className="flex items-center justify-between text-xs text-slate-300 border border-slate-800 rounded px-2 py-2">
                                                            <div>
                                                                <p className="font-semibold text-slate-200">{entry.requestType}</p>
                                                                <p className="text-[10px] text-slate-500">
                                                                    {new Date(entry.timestamp).toLocaleString()}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className={`text-[11px] ${entry.success ? 'text-emerald-300' : 'text-red-300'}`}>
                                                                    {entry.success ? 'OK' : 'Erro'}
                                                                </p>
                                                                <p className="text-[10px] text-slate-500">
                                                                    {entry.latencyMs?.toFixed ? entry.latencyMs.toFixed(0) : entry.latencyMs} ms
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <ModuleRecommendations
                            modules={moduleInputs}
                            allFiles={allFilePathsRef.current}
                            graphNodes={Object.values(graphNodesById)}
                            semanticLinks={Object.values(semanticLinksById)}
                            onChange={setModuleInputs}
                        />
                    )}
                </div>
            </div>

            {/* Template Wizard Modal */}
            {wizardTemplate && (
                <TemplateWizard
                    template={wizardTemplate}
                    targetComponent={selectedNode}
                    onClose={() => setWizardTemplate(null)}
                    onApply={handleWizardApply}
                />
            )}

        </div>
    );
};

export default App;
