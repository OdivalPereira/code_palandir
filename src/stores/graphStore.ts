import { create } from './zustand';
import {
  analyzeFile,
  fetchAiMetrics,
  fetchSessionAccessToken,
  logoutSession,
  openSession,
  optimizePrompt,
  projectSummary,
  relevantFiles,
  saveSession,
  PROJECT_SUMMARY_PROMPT_BASE,
} from '../api/client';
import { clearSessionAccessToken } from '../authClient';
import { getCachedFileContent, hashContent, setCachedFileContent } from '../cacheRepository';
import { fetchGitHubJson } from '../githubClient';
import { buildSemanticLinksForFile, SymbolIndex } from '../dependencyParser';
import type { BackendTemplate } from '../components/TemplateSidebar';
import {
  AiMetricsResponse,
  AppStatus,
  CodeNode,
  FileSystemNode,
  FlatNode,
  Link,
  GraphViewMode,
  MissingDependency,
  ModuleInput,
  PromptItem,
  ProjectGraphInput,
  ProjectSummary,
  SemanticLink,
  SESSION_SCHEMA_VERSION,
  SessionPayload,
  SessionGraphState,
  SessionSelectionState,
  UIIntentSchema,
} from '../types';

export type GraphState = {
  fileMap: Map<string, string>;
  status: AppStatus;
  isAuthenticated: boolean;
  authNotice: string | null;
  promptItems: PromptItem[];
  searchQuery: string;
  githubUrl: string;
  isPromptOpen: boolean;
  sidebarTab: 'prompt' | 'summary' | 'recommendations' | 'flow' | 'metrics';
  sessionId: string | null;
  projectSignature: string | null;
  summaryPromptBase: string;
  projectSummary: ProjectSummary | null;
  summaryStatus: 'idle' | 'loading' | 'error';
  summaryError: string | null;
  aiMetrics: AiMetricsResponse | null;
  aiMetricsStatus: 'idle' | 'loading' | 'error';
  aiMetricsError: string | null;
  moduleInputs: ModuleInput[];
  ghostNodes: FlatNode[];
  ghostLinks: Link[];
  missingDependencies: MissingDependency[];
  allFilePaths: string[];
  localFileHandles: Map<string, File>;
  childrenIndex: Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>;
  descendantCount: Map<string, number>;
  autoRestoreSignature: string | null;
  wizardTemplate: BackendTemplate | null;
  // UI actions
  setSearchQuery: (query: string) => void;
  setGithubUrl: (url: string) => void;
  setPromptOpen: (open: boolean) => void;
  setSidebarTab: (tab: 'prompt' | 'summary' | 'recommendations' | 'flow' | 'metrics') => void;
  setSummaryPromptBase: (base: string) => void;
  setPromptItems: (items: PromptItem[]) => void;
  addPromptItem: (item: PromptItem) => void;
  removePromptItem: (id: string) => void;
  clearPromptItems: () => void;
  setModuleInputs: (modules: ModuleInput[]) => void;
  setGhostData: (nodes: FlatNode[], links: Link[], deps: MissingDependency[]) => void;
  clearGhostData: () => void;
  clearAiResponse: () => void;
  setWizardTemplate: (template: BackendTemplate | null) => void;
  setAuthNotice: (notice: string | null) => void;
  refreshAuthSession: () => Promise<void>;
  logout: () => Promise<void>;
  // Data actions
  processFiles: (files: FileList) => Promise<void>;
  importGithubRepo: () => Promise<void>;
  searchRelevantFiles: () => Promise<void>;
  ensureFileContent: (path: string) => Promise<string | undefined>;
  analyzeSelectedFile: (selectedNode: FlatNode | null) => Promise<void>;
  refreshAiMetrics: () => Promise<void>;
  generateSummary: () => Promise<void>;
  handleSaveSession: () => Promise<void>;
  restoreSessionById: (requestedId: string, signatureOverride?: string | null) => Promise<void>;
  storeSessionMeta: (nextSessionId: string, signature: string | null) => void;
  tryRestoreSavedSession: (signature: string) => Promise<void>;
  buildProjectGraphInput: () => ProjectGraphInput;
  buildSessionPayload: () => SessionPayload;
  updateSemanticEdgesForFile: (path: string, content: string, codeStructure?: CodeNode[]) => void;
  findCodeStructureForPath: (path: string) => CodeNode[] | undefined;
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  loadingPaths: Set<string>;
  nodes: FlatNode[];
  links: Link[];
  selectedNode: FlatNode | null;
  isLoading: boolean;
  aiResponse: string | null;
  expandedDirectories: Set<string>;
  layoutCache: { hash: string; positions: Record<string, { x: number; y: number }> } | null;
  sessionLayout: { hash: string; positions: Record<string, { x: number; y: number }> } | null;
  nodesById: Record<string, FlatNode>;
  linksById: Record<string, Link>;
  semanticLinksById: Record<string, SemanticLink>;
  graphViewMode: GraphViewMode;
  flowQuery: { sourceId: string | null; targetId: string | null };
  flowPathNodeIds: Set<string>;
  flowPathLinkIds: Set<string>;
  requestExpandNode: ((path: string) => void) | null;
  // Actions
  setGraphData: (nodes: FlatNode[], links: Link[]) => void;
  setRootNode: (rootNode: FileSystemNode | null) => void;
  updateRootNode: (updater: (current: FileSystemNode | null) => FileSystemNode | null) => void;
  setHighlightedPaths: (paths: string[]) => void;
  setLoadingPaths: (paths: Set<string>) => void;
  selectNode: (nodeId: string | null) => void;
  fetchAiOptimization: (nodeId: string, userIntent: string) => Promise<void>;
  expandDirectory: (path: string) => void;
  toggleDirectory: (path: string) => void;
  setRequestExpandNode: (handler: ((path: string) => void) | null) => void;
  restoreSession: (graph: SessionGraphState, selection: SessionSelectionState) => void;
  setLayoutCache: (hash: string, positions: Record<string, { x: number; y: number }>) => void;
  setSessionLayout: (layout: { hash: string; positions: Record<string, { x: number; y: number }> } | null) => void;
  setSemanticLinks: (links: SemanticLink[], sourceIds?: Set<string>) => void;
  setGraphViewMode: (mode: GraphViewMode) => void;
  setFlowQuery: (sourceId: string | null, targetId: string | null) => void;
  setFlowHighlight: (nodeIds: string[], linkIds: string[]) => void;
  clearFlowHighlight: () => void;
  expandNode: (path: string) => void;
};

const LAST_SESSION_STORAGE_KEY = 'codemind:lastSession';
const analysisCacheTtlEnv = Number(import.meta.env.VITE_ANALYSIS_CACHE_TTL_MS ?? '0');
const analysisCacheTtlMs = Number.isFinite(analysisCacheTtlEnv) && analysisCacheTtlEnv > 0
  ? analysisCacheTtlEnv
  : undefined;
const relevantCacheTtlEnv = Number(import.meta.env.VITE_RELEVANT_FILES_CACHE_TTL_MS ?? '0');
const relevantCacheTtlMs = Number.isFinite(relevantCacheTtlEnv) && relevantCacheTtlEnv > 0
  ? relevantCacheTtlEnv
  : undefined;
const AUTH_NOTICE_MESSAGE = 'Conecte-se com GitHub para habilitar recursos de IA.';

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

const computeProjectSignature = async (paths: string[], sourceId: string) => {
  const normalized = [...paths].sort().join('|');
  return hashContent(`${sourceId}::${normalized}`);
};

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

const buildChildNodes = (
  parentPath: string,
  index: Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>,
  descendantCount: Map<string, number>
) => {
  const entries = (index.get(parentPath) ?? []).slice();
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries.map((entry) => ({
    id: entry.path,
    name: entry.name,
    type: entry.type,
    path: entry.path,
    hasChildren: entry.type === 'directory' ? (index.get(entry.path)?.length ?? 0) > 0 : false,
    descendantCount: descendantCount.get(entry.path) ?? 0,
    children: undefined
  }));
};

const buildGraphHashData = (
  rootNode: FileSystemNode | null,
  highlightedPaths: string[],
  expanded: Set<string>
): { nodes: FlatNode[]; links: Link[]; nodesById: Record<string, FlatNode>; linksById: Record<string, Link> } => {
  if (!rootNode) return { nodes: [], links: [], nodesById: {}, linksById: {} };
  const nodesById: Record<string, FlatNode> = {};
  const linksById: Record<string, Link> = {};

  const countDescendants = (node: FileSystemNode): number => {
    if (typeof node.descendantCount === 'number') return node.descendantCount;
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
  };

  const linkIdFor = (source: string, target: string) => `${source}-->${target}`;

  const registerNode = (node: FlatNode) => {
    nodesById[node.id] = node;
  };

  const registerLink = (source: string, target: string) => {
    const linkId = linkIdFor(source, target);
    linksById[linkId] = { source, target, kind: 'structural' };
  };

  const traverse = (node: FileSystemNode, parentId: string | null, depth: number) => {
    // Check if directory is collapsed (not in expanded set)
    // Root is always expanded by default
    const isExpanded = expanded.has(node.path) || node.path === '';
    const hasChildren = (node.children && node.children.length > 0) || node.hasChildren;

    const flatNode: FlatNode = {
      id: node.path,
      name: node.name,
      type: node.type,
      path: node.path,
      group: depth,
      relevant: highlightedPaths.some(p => node.path.includes(p)),
      data: node,
      collapsed: !isExpanded && hasChildren && node.type === 'directory',
      childCount: hasChildren ? countDescendants(node) : 0,
      x: 0,
      y: 0
    };
    registerNode(flatNode);

    if (parentId) {
      registerLink(parentId, node.path);
    }

    if (hasChildren && isExpanded) {
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, node.path, depth + 1));
      }
    }

    if (node.codeStructure && isExpanded) {
      node.codeStructure.forEach((codeNode) => {
        const codeId = `${node.path}#${codeNode.name}`;
        const flatCodeNode: FlatNode = {
          id: codeId,
          name: codeNode.name,
          type: codeNode.type,
          path: codeId,
          group: depth + 1,
          relevant: false,
          data: codeNode,
          x: 0,
          y: 0
        };
        registerNode(flatCodeNode);
        registerLink(node.path, codeId);
      });
    }
  };

  traverse(rootNode, null, 1);
  return {
    nodes: Object.values(nodesById),
    links: Object.values(linksById),
    nodesById,
    linksById,
  };
};

const computeGraph = (
  rootNode: FileSystemNode | null,
  highlightedPaths: string[],
  expandedDirectories: Set<string>
) => buildGraphHashData(rootNode, highlightedPaths, expandedDirectories);

export const useGraphStore = create<GraphState>((set, get) => ({
  fileMap: new Map(),
  status: AppStatus.IDLE,
  isAuthenticated: false,
  authNotice: null,
  promptItems: [],
  searchQuery: '',
  githubUrl: '',
  isPromptOpen: false,
  sidebarTab: 'prompt',
  sessionId: null,
  projectSignature: null,
  summaryPromptBase: PROJECT_SUMMARY_PROMPT_BASE,
  projectSummary: null,
  summaryStatus: 'idle',
  summaryError: null,
  aiMetrics: null,
  aiMetricsStatus: 'idle',
  aiMetricsError: null,
  moduleInputs: [],
  ghostNodes: [],
  ghostLinks: [],
  missingDependencies: [],
  allFilePaths: [],
  localFileHandles: new Map(),
  childrenIndex: new Map(),
  descendantCount: new Map(),
  autoRestoreSignature: null,
  wizardTemplate: null,
  setSearchQuery: (query) => set({ searchQuery: query }),
  setGithubUrl: (url) => set({ githubUrl: url }),
  setPromptOpen: (open) => set({ isPromptOpen: open }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSummaryPromptBase: (base) => set({ summaryPromptBase: base }),
  setPromptItems: (items) => set({ promptItems: items }),
  addPromptItem: (item) => set((state) => ({ promptItems: [...state.promptItems, item] })),
  removePromptItem: (id) => set((state) => ({
    promptItems: state.promptItems.filter((item) => item.id !== id)
  })),
  clearPromptItems: () => set({ promptItems: [] }),
  setModuleInputs: (modules) => set({ moduleInputs: modules }),
  setGhostData: (nodes, links, deps) => set({
    ghostNodes: nodes,
    ghostLinks: links,
    missingDependencies: deps
  }),
  clearGhostData: () => set({ ghostNodes: [], ghostLinks: [], missingDependencies: [] }),
  clearAiResponse: () => set({ aiResponse: null }),
  setWizardTemplate: (template) => set({ wizardTemplate: template }),
  setAuthNotice: (notice) => set({ authNotice: notice }),
  refreshAuthSession: async () => {
    try {
      const accessToken = await fetchSessionAccessToken();
      const isAuthenticated = Boolean(accessToken);
      set({
        isAuthenticated,
        authNotice: isAuthenticated ? null : AUTH_NOTICE_MESSAGE
      });
    } catch (error) {
      console.error(error);
      set({ isAuthenticated: false, authNotice: AUTH_NOTICE_MESSAGE });
    }
  },
  logout: async () => {
    try {
      await logoutSession();
    } catch (error) {
      console.error(error);
    }
    clearSessionAccessToken();
    set({ isAuthenticated: false, authNotice: AUTH_NOTICE_MESSAGE });
  },
  processFiles: async (files) => {
    set({ status: AppStatus.LOADING_FILES });
    const newFileHandles = new Map<string, File>();
    const allPaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.webkitRelativePath.includes('/.') || file.name.startsWith('.')) continue;
      newFileHandles.set(file.webkitRelativePath, file);
      allPaths.push(file.webkitRelativePath);
    }

    const childrenIndex = buildChildrenIndex(allPaths);
    const descendantCount = computeDescendantCounts(childrenIndex);

    const rootChildren = buildChildNodes('', childrenIndex, descendantCount);
    const root: FileSystemNode = {
      id: 'root',
      name: 'Project Root',
      type: 'directory',
      path: '',
      children: rootChildren,
      hasChildren: rootChildren.length > 0,
      descendantCount: descendantCount.get('') ?? rootChildren.length
    };

    get().setRootNode(root);
    set({
      fileMap: new Map(),
      moduleInputs: [],
      status: AppStatus.IDLE,
      sessionLayout: null,
      childrenIndex,
      descendantCount,
      localFileHandles: newFileHandles,
      allFilePaths: allPaths
    });

    const signature = await computeProjectSignature(allPaths, 'local');
    set({ projectSignature: signature });
    await get().tryRestoreSavedSession(signature);
  },
  importGithubRepo: async () => {
    const githubUrl = get().githubUrl;
    if (!githubUrl) return;
    set({ status: AppStatus.LOADING_FILES });
    try {
      const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) throw new Error('Invalid GitHub URL');
      const [_, owner, repo] = match;

      let defaultBranch = 'main';
      try {
        const repoData = await fetchGitHubJson<{ default_branch?: string }>(
          `https://api.github.com/repos/${owner}/${repo}`
        );
        if (repoData.default_branch) {
          defaultBranch = repoData.default_branch;
        }
      } catch (error) {
        console.warn('Failed to load default branch from GitHub API, using main fallback.', error);
      }

      const treeData = await fetchGitHubJson<{ tree: { type: string; path: string }[] }>(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
      );

      const paths = treeData.tree.filter((item: { type: string }) => item.type === 'blob').map((item: { path: string }) => item.path);
      const childrenIndex = buildChildrenIndex(paths);
      const descendantCount = computeDescendantCounts(childrenIndex);

      const rootChildren = buildChildNodes('', childrenIndex, descendantCount);
      const root: FileSystemNode = {
        id: 'root',
        name: repo,
        type: 'directory',
        path: '',
        children: rootChildren,
        hasChildren: rootChildren.length > 0,
        descendantCount: descendantCount.get('') ?? rootChildren.length
      };

      get().setRootNode(root);
      set({
        fileMap: new Map(),
        moduleInputs: [],
        status: AppStatus.IDLE,
        sessionLayout: null,
        childrenIndex,
        descendantCount,
        localFileHandles: new Map(),
        allFilePaths: paths
      });

      const signature = await computeProjectSignature(paths, `github:${owner}/${repo}`);
      set({ projectSignature: signature });
      await get().tryRestoreSavedSession(signature);
    } catch (error) {
      console.error(error);
      alert("Error importing from GitHub. Ensure it's a public repo.");
      set({ status: AppStatus.ERROR });
    }
  },
  searchRelevantFiles: async () => {
    const { searchQuery, rootNode, allFilePaths } = get();
    if (!searchQuery.trim() || !rootNode) return;
    if (!get().isAuthenticated) {
      set({ authNotice: AUTH_NOTICE_MESSAGE });
      return;
    }
    set({ status: AppStatus.ANALYZING_QUERY });
    try {
      const relevantPaths = await relevantFiles(searchQuery, allFilePaths, { ttlMs: relevantCacheTtlMs });
      get().setHighlightedPaths(relevantPaths);
      get().addPromptItem({
        id: Date.now().toString(),
        title: 'Goal',
        content: searchQuery,
        type: 'context'
      });
      set({ status: AppStatus.IDLE });
    } catch (error) {
      console.error(error);
      set({ status: AppStatus.ERROR });
    }
  },
  ensureFileContent: async (path) => {
    let content = get().fileMap.get(path);
    const { localFileHandles, githubUrl } = get();

    if (!content && localFileHandles.size > 0) {
      const localFile = localFileHandles.get(path);
      if (localFile) {
        content = await localFile.text();
        set((state) => ({
          fileMap: new Map(state.fileMap).set(path, content!)
        }));
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
            set((state) => ({
              fileMap: new Map(state.fileMap).set(path, content!)
            }));
            return content;
          }

          const data = await fetchGitHubJson<{ content?: string }>(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
          );
          if (data.content) {
            content = atob(data.content);
            await setCachedFileContent(cacheKey, content);
            set((state) => ({
              fileMap: new Map(state.fileMap).set(path, content!)
            }));
          }
        } catch (e) {
          console.error('Failed to fetch file content', e);
        }
      }
    }

    if (content) {
      const existingStructure = get().findCodeStructureForPath(path);
      get().updateSemanticEdgesForFile(path, content, existingStructure);
    }
    return content;
  },
  analyzeSelectedFile: async (selectedNode) => {
    if (!selectedNode || selectedNode.type !== 'file') return;
    const selectedPath = selectedNode.path;
    const selectedName = selectedNode.name;
    const content = await get().ensureFileContent(selectedPath);
    if (!content) return;

    const currentRoot = get().rootNode;
    if (!currentRoot) return;

    const updateTree = (node: FileSystemNode): boolean => {
      if (node.path === selectedPath) {
        if (!node.codeStructure) {
          if (!get().isAuthenticated) {
            set({ authNotice: AUTH_NOTICE_MESSAGE });
            return true;
          }
          set({ status: AppStatus.ANALYZING_QUERY });
          analyzeFile(content, selectedName, { ttlMs: analysisCacheTtlMs }).then((structure) => {
            node.codeStructure = structure;
            get().updateRootNode(prev => (prev ? { ...prev } : null));
            get().updateSemanticEdgesForFile(selectedPath, content, structure);
            set({ status: AppStatus.IDLE });
          });
        }
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (updateTree(child)) return true;
        }
      }
      return false;
    };
    updateTree(currentRoot);
  },
  refreshAiMetrics: async () => {
    if (!get().isAuthenticated) {
      set({ authNotice: AUTH_NOTICE_MESSAGE });
      return;
    }
    set({ aiMetricsStatus: 'loading', aiMetricsError: null });
    try {
      const payload = await fetchAiMetrics();
      set({ aiMetrics: payload, aiMetricsStatus: 'idle' });
    } catch (error) {
      console.error(error);
      set({
        aiMetricsStatus: 'error',
        aiMetricsError: error instanceof Error ? error.message : 'Falha ao carregar métricas.'
      });
    }
  },
  generateSummary: async () => {
    const { rootNode, promptItems, summaryPromptBase, allFilePaths } = get();
    if (!rootNode) return;
    if (!get().isAuthenticated) {
      set({
        authNotice: AUTH_NOTICE_MESSAGE,
        summaryStatus: 'error',
        summaryError: 'Conecte-se com GitHub para gerar o resumo.'
      });
      return;
    }
    set({ summaryStatus: 'loading', summaryError: null });
    try {
      const graph = get().buildProjectGraphInput();
      const context = promptItems
        .filter((item) => item.type !== 'code')
        .map((item) => `${item.title}: ${item.content}`);
      const summary = await projectSummary({
        filePaths: allFilePaths,
        graph,
        context,
        promptBase: summaryPromptBase
      });
      set({ projectSummary: summary, summaryStatus: 'idle' });
    } catch (error) {
      console.error(error);
      set({ summaryStatus: 'error', summaryError: 'Falha ao gerar resumo. Tente novamente.' });
    }
  },
  handleSaveSession: async () => {
    const { rootNode, sessionId, projectSignature } = get();
    if (!rootNode) {
      alert('Load a project before saving a session.');
      return;
    }
    try {
      const payload = get().buildSessionPayload();
      const response = await saveSession(payload, sessionId);
      set({ sessionId: response.sessionId });
      get().storeSessionMeta(response.sessionId, projectSignature);
      alert(`Session saved. ID: ${response.sessionId}`);
    } catch (error) {
      console.error(error);
      alert('Failed to save session.');
    }
  },
  restoreSessionById: async (requestedId, signatureOverride) => {
    const response = await openSession(requestedId.trim());
    get().restoreSession(response.session.graph, response.session.selection);
    set({
      promptItems: response.session.prompts,
      sessionId: response.sessionId,
      sessionLayout: response.session.layout
        ? { hash: response.session.layout.graphHash, positions: response.session.layout.positions }
        : null,
      fileMap: new Map(),
      status: AppStatus.IDLE
    });
    get().storeSessionMeta(response.sessionId, signatureOverride ?? get().projectSignature);
  },
  storeSessionMeta: (nextSessionId, signature) => {
    if (typeof window === 'undefined' || !signature) return;
    window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify({
      sessionId: nextSessionId,
      projectSignature: signature
    }));
  },
  tryRestoreSavedSession: async (signature) => {
    if (get().autoRestoreSignature === signature) return;
    set({ autoRestoreSignature: signature });
    const stored = loadStoredSessionMeta();
    if (!stored || stored.projectSignature !== signature) return;
    try {
      await get().restoreSessionById(stored.sessionId, signature);
    } catch (error) {
      console.error(error);
    }
  },
  buildProjectGraphInput: () => {
    const { nodesById, linksById } = get();
    const nodes = Object.values(nodesById).map(node => ({
      id: node.id,
      type: node.type,
      label: node.name,
      path: node.path
    }));
    const edges = Object.values(linksById).map(link => ({
      source: typeof link.source === 'string' ? link.source : link.source.id,
      target: typeof link.target === 'string' ? link.target : link.target.id
    }));
    return { nodes, edges };
  },
  buildSessionPayload: () => {
    const graphState = get();
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
        selectedNodeId: graphState.selectedNode?.id ?? null
      },
      prompts: graphState.promptItems,
      layout: layoutCache
        ? {
          graphHash: layoutCache.hash,
          positions: layoutCache.positions
        }
        : null
    };
  },
  updateSemanticEdgesForFile: (path, content, codeStructure) => {
    const filePaths = new Set(get().allFilePaths);
    if (filePaths.size === 0) return;
    const index: SymbolIndex = new Map();
    Object.values(get().nodesById).forEach((node) => {
      if (node.type === 'function' || node.type === 'class' || node.type === 'variable' || node.type === 'api_endpoint') {
        const existing = index.get(node.name) ?? [];
        existing.push(node.id);
        index.set(node.name, existing);
      }
    });
    const { links, sourceIds } = buildSemanticLinksForFile({
      sourcePath: path,
      content,
      codeStructure,
      filePaths,
      symbolIndex: index
    });
    const normalizedLinks: SemanticLink[] = links.map((link) => ({
      ...link,
      source: typeof link.source === 'string' ? link.source : link.source.id,
      target: typeof link.target === 'string' ? link.target : link.target.id
    }));
    get().setSemanticLinks(normalizedLinks, sourceIds);
  },
  findCodeStructureForPath: (path) => {
    const root = get().rootNode;
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
  },
  rootNode: null,
  highlightedPaths: [],
  loadingPaths: new Set(),
  nodes: [],
  links: [],
  selectedNode: null,
  isLoading: false,
  aiResponse: null,
  expandedDirectories: new Set(),
  layoutCache: null,
  sessionLayout: null,
  nodesById: {},
  linksById: {},
  semanticLinksById: {},
  graphViewMode: 'structural',
  flowQuery: { sourceId: null, targetId: null },
  flowPathNodeIds: new Set(),
  flowPathLinkIds: new Set(),
  requestExpandNode: (path) => get().expandNode(path),
  setGraphData: (nodes, links) => {
    const nodesById: Record<string, FlatNode> = {};
    nodes.forEach((node) => {
      nodesById[node.id] = node;
    });
    const linksById: Record<string, Link> = {};
    links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const linkId = link.kind ? `${link.kind}:${sourceId}-->${targetId}` : `${sourceId}-->${targetId}`;
      linksById[linkId] = { ...link, source: sourceId, target: targetId };
    });
    const selectedNodeId = get().selectedNode?.id ?? null;
    set({
      nodes,
      links,
      nodesById,
      linksById,
      selectedNode: selectedNodeId ? nodesById[selectedNodeId] ?? null : null,
    });
  },
  setRootNode: (rootNode) => {
    const expandedDirectories = rootNode ? new Set<string>([rootNode.path]) : new Set<string>();
    const { nodes, links, nodesById, linksById } = computeGraph(rootNode, get().highlightedPaths, expandedDirectories);
    set({
      rootNode,
      expandedDirectories,
      nodes,
      links,
      nodesById,
      linksById,
      selectedNode: null,
      layoutCache: null,
      semanticLinksById: {},
      graphViewMode: 'structural',
      flowQuery: { sourceId: null, targetId: null },
      flowPathNodeIds: new Set(),
      flowPathLinkIds: new Set()
    });
  },
  updateRootNode: (updater) => {
    set((state) => {
      const nextRoot = updater(state.rootNode);
      const expandedDirectories = nextRoot
        ? (state.expandedDirectories.size ? state.expandedDirectories : new Set<string>([nextRoot.path]))
        : new Set<string>();
      const { nodes, links, nodesById, linksById } = computeGraph(nextRoot, state.highlightedPaths, expandedDirectories);
      return {
        rootNode: nextRoot,
        expandedDirectories,
        nodes,
        links,
        nodesById,
        linksById,
        selectedNode: state.selectedNode?.id ? nodesById[state.selectedNode.id] ?? null : null,
      };
    });
  },
  setHighlightedPaths: (paths) => {
    const { rootNode, expandedDirectories } = get();
    const { nodes, links, nodesById, linksById } = computeGraph(rootNode, paths, expandedDirectories);
    set({ highlightedPaths: paths, nodes, links, nodesById, linksById });
  },
  setLoadingPaths: (paths) => set({ loadingPaths: paths }),
  selectNode: (nodeId) => {
    const selectedNode = nodeId ? get().nodesById[nodeId] ?? null : null;
    set({ selectedNode });
  },
  fetchAiOptimization: async (nodeId, userIntent) => {
    if (!get().isAuthenticated) {
      set({
        authNotice: AUTH_NOTICE_MESSAGE,
        aiResponse: 'Conecte-se com GitHub para usar a IA.',
        isLoading: false
      });
      return;
    }
    const node = get().nodesById[nodeId];
    if (!node) {
      set({ aiResponse: 'Selecione um nó válido para otimizar.', isLoading: false });
      return;
    }
    const fileContent = (node.data as FileSystemNode | undefined)?.content ?? '';
    if (!fileContent) {
      set({
        aiResponse: 'Conteúdo do arquivo não disponível. Clique no arquivo para carregar primeiro.',
        isLoading: false,
      });
      return;
    }
    const uiIntentSchema: UIIntentSchema = {
      component: node.name,
      fields: [],
      actions: [],
      dataFlow: {
        direction: 'mixed',
        entityGuess: node.name,
        confidence: 0,
      },
      hooks: [],
    };
    set({ isLoading: true, aiResponse: null });
    try {
      const prompt = await optimizePrompt({
        userIntent: userIntent.trim() || `Implementar funcionalidade para ${node.name}`,
        fileContent,
        selectedNode: {
          id: node.id,
          name: node.name,
          path: node.path,
          type: node.type,
        },
        uiIntentSchema,
        projectStructure: {
          hasBackend: false,
          stack: [],
          existingEndpoints: [],
        },
        backendRequirements: {
          tables: [],
          endpoints: [],
          services: [],
        },
      });
      set({ aiResponse: prompt, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao otimizar a resposta da IA.';
      set({ aiResponse: message, isLoading: false });
    }
  },
  expandDirectory: (path) => {
    set((state) => {
      if (state.expandedDirectories.has(path)) {
        return state;
      }
      const expandedDirectories = new Set(state.expandedDirectories);
      expandedDirectories.add(path);
      const { nodes, links, nodesById, linksById } = computeGraph(state.rootNode, state.highlightedPaths, expandedDirectories);
      return { expandedDirectories, nodes, links, nodesById, linksById };
    });
  },
  toggleDirectory: (path) => {
    set((state) => {
      const expandedDirectories = new Set(state.expandedDirectories);
      if (expandedDirectories.has(path)) {
        expandedDirectories.delete(path);
      } else {
        expandedDirectories.add(path);
      }
      const { nodes, links, nodesById, linksById } = computeGraph(state.rootNode, state.highlightedPaths, expandedDirectories);
      return { expandedDirectories, nodes, links, nodesById, linksById };
    });
  },
  setRequestExpandNode: (handler) => set({ requestExpandNode: handler }),
  restoreSession: (graph, selection) => {
    const expandedDirectories = new Set(graph.expandedDirectories);
    const { nodes, links, nodesById, linksById } = computeGraph(graph.rootNode, graph.highlightedPaths, expandedDirectories);
    const nextSelected = selection.selectedNodeId && nodesById[selection.selectedNodeId]
      ? nodesById[selection.selectedNodeId]
      : null;
    const semanticLinksById: Record<string, SemanticLink> = {};
    if (graph.semanticLinks) {
      graph.semanticLinks.forEach((link) => {
        const id = `${link.kind}:${link.source}-->${link.target}`;
        semanticLinksById[id] = { ...link };
      });
    }
    set({
      rootNode: graph.rootNode,
      highlightedPaths: graph.highlightedPaths,
      expandedDirectories,
      nodes,
      links,
      nodesById,
      linksById,
      selectedNode: nextSelected,
      layoutCache: null,
      semanticLinksById,
      graphViewMode: graph.graphViewMode ?? 'structural',
      flowQuery: { sourceId: null, targetId: null },
      flowPathNodeIds: new Set(),
      flowPathLinkIds: new Set()
    });
  },
  setLayoutCache: (hash, positions) => set({ layoutCache: { hash, positions } }),
  setSessionLayout: (layout) => set({ sessionLayout: layout }),
  setSemanticLinks: (links, sourceIds) => {
    set((state) => {
      const nextLinks = { ...state.semanticLinksById };
      if (sourceIds && sourceIds.size > 0) {
        Object.entries(nextLinks).forEach(([id, link]) => {
          if (sourceIds.has(link.source as string)) {
            delete nextLinks[id];
          }
        });
      }
      links.forEach((link) => {
        const source = typeof link.source === 'string' ? link.source : link.source.id;
        const target = typeof link.target === 'string' ? link.target : link.target.id;
        const id = `${link.kind}:${source}-->${target}`;
        nextLinks[id] = { ...link, source, target };
      });
      return { semanticLinksById: nextLinks };
    });
  },
  setGraphViewMode: (mode) => set({ graphViewMode: mode }),
  setFlowQuery: (sourceId, targetId) => set({ flowQuery: { sourceId, targetId } }),
  setFlowHighlight: (nodeIds, linkIds) => set({
    flowPathNodeIds: new Set(nodeIds),
    flowPathLinkIds: new Set(linkIds)
  }),
  clearFlowHighlight: () => set({
    flowPathNodeIds: new Set(),
    flowPathLinkIds: new Set()
  }),
  expandNode: (path) => {
    const { rootNode, loadingPaths, childrenIndex, descendantCount } = get();
    if (!rootNode) return;
    if (!childrenIndex.has(path)) return;
    if (loadingPaths.has(path)) return;

    const updateTree = (node: FileSystemNode): FileSystemNode => {
      if (node.path === path) {
        if (node.children && node.children.length > 0) {
          return node;
        }
        const nextChildren = buildChildNodes(path, childrenIndex, descendantCount);
        return { ...node, children: nextChildren };
      }
      if (!node.children) return node;
      return {
        ...node,
        children: node.children.map(child => updateTree(child))
      };
    };

    get().setLoadingPaths(new Set([...loadingPaths, path]));
    get().updateRootNode((prev) => (prev ? updateTree(prev) : prev));
    window.setTimeout(() => {
      const currentLoading = get().loadingPaths;
      const next = new Set(currentLoading);
      next.delete(path);
      get().setLoadingPaths(next);
    }, 250);
  }
}));
