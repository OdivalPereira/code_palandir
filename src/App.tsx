import React, { useState, useRef, useEffect } from 'react';
import CodeVisualizer from './components/CodeVisualizer';
import PromptBuilder from './components/PromptBuilder';
import { analyzeFileContent, findRelevantFiles } from './geminiService';
import { FileSystemNode, PromptItem, AppStatus, CodeNode } from './types';
import { Search, FolderOpen, Github, Loader2, Sparkles, FileText, Plus } from 'lucide-react';
import { useGraphStore } from './stores/graphStore';

const App: React.FC = () => {
    const [fileMap, setFileMap] = useState<Map<string, string>>(new Map());
    const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [isPromptOpen, setIsPromptOpen] = useState(false);

    const rootNode = useGraphStore((state) => state.rootNode);
    const selectedNode = useGraphStore((state) => state.selectedNode);
    const loadingPaths = useGraphStore((state) => state.loadingPaths);
    const setRootNode = useGraphStore((state) => state.setRootNode);
    const updateRootNode = useGraphStore((state) => state.updateRootNode);
    const setHighlightedPaths = useGraphStore((state) => state.setHighlightedPaths);
    const setLoadingPaths = useGraphStore((state) => state.setLoadingPaths);
    const setSelectedNode = useGraphStore((state) => state.setSelectedNode);
    const setRequestExpandNode = useGraphStore((state) => state.setRequestExpandNode);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const childrenIndexRef = useRef<Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>>(new Map());
    const descendantCountRef = useRef<Map<string, number>>(new Map());
    const localFileHandlesRef = useRef<Map<string, File>>(new Map());
    const allFilePathsRef = useRef<string[]>([]);

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
        setStatus(AppStatus.IDLE);
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
            const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
            if (!treeRes.ok) throw new Error("Failed to fetch repo tree. Check if main branch exists or rate limit.");
            const treeData = await treeRes.json();

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
            setStatus(AppStatus.IDLE);

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
            const relevantPaths = await findRelevantFiles(searchQuery, allPaths);
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
                    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
                    const data = await res.json();
                    if (data.content) {
                        content = atob(data.content);
                        setFileMap(prev => new Map(prev).set(path, content!));
                    }
                } catch (e) {
                    console.error("Failed to fetch file content", e);
                }
            }
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
                        analyzeFileContent(content, n.name).then(structure => {
                            if (!isActive) return;
                            n.codeStructure = structure;
                            updateRootNode(prev => (prev ? { ...prev } : null));
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

    const addToPrompt = (title: string, content: string) => {
        setPromptItems(prev => [...prev, {
            id: Date.now().toString(),
            title,
            content,
            type: 'code'
        }]);
        setIsPromptOpen(true);
    };

    return (
        <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">

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
                        onClick={() => setIsPromptOpen(!isPromptOpen)}
                        className={`p-2 rounded-lg transition-colors relative ${isPromptOpen ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                    >
                        <FileText size={20} />
                        {promptItems.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                                {promptItems.length}
                            </span>
                        )}
                    </button>
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

            {/* Right Sidebar: Prompt Builder (Collapsible) */}
            <div
                className={`bg-slate-900 border-l border-slate-800 transition-all duration-300 ease-in-out flex flex-col ${isPromptOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full opacity-0'
                    }`}
            >
                <div className="flex-1 overflow-hidden">
                    <PromptBuilder
                        items={promptItems}
                        onRemove={(id) => setPromptItems(prev => prev.filter(i => i.id !== id))}
                        onClear={() => setPromptItems([])}
                    />
                </div>
            </div>

        </div>
    );
};

export default App;
