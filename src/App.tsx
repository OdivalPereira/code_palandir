import React, { useState, useRef } from 'react';
import CodeVisualizer from './components/CodeVisualizer';
import PromptBuilder from './components/PromptBuilder';
import { analyzeFileContent, findRelevantFiles } from './geminiService';
import { FileSystemNode, FlatNode, PromptItem, AppStatus, CodeNode } from './types';
import { Search, FolderOpen, Github, Loader2, Sparkles, FileText, Plus } from 'lucide-react';

const App: React.FC = () => {
    const [rootNode, setRootNode] = useState<FileSystemNode | null>(null);
    const [fileMap, setFileMap] = useState<Map<string, string>>(new Map());
    const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [highlightedPaths, setHighlightedPaths] = useState<string[]>([]);
    const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<FlatNode | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- File Loading Logic ---

    const processFiles = async (files: FileList) => {
        setStatus(AppStatus.LOADING_FILES);
        const newFileMap = new Map<string, string>();
        const root: FileSystemNode = { id: 'root', name: 'Project Root', type: 'directory', path: '', children: [] };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Skip hidden files/folders roughly
            if (file.webkitRelativePath.includes('/.') || file.name.startsWith('.')) continue;

            const text = await file.text();
            newFileMap.set(file.webkitRelativePath, text);

            // Build tree
            const parts = file.webkitRelativePath.split('/');
            let current = root;

            for (let j = 0; j < parts.length; j++) {
                const part = parts[j];
                const isFile = j === parts.length - 1;
                const path = parts.slice(0, j + 1).join('/');

                let child = current.children?.find(c => c.name === part);
                if (!child) {
                    child = {
                        id: path,
                        name: part,
                        type: isFile ? 'file' : 'directory',
                        path: path,
                        children: isFile ? undefined : []
                    };
                    current.children = current.children || [];
                    current.children.push(child);
                }
                current = child;
            }
        }

        setFileMap(newFileMap);
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

            const newFileMap = new Map<string, string>();
            const root: FileSystemNode = { id: 'root', name: repo, type: 'directory', path: '', children: [] };

            // We won't fetch ALL content immediately to avoid rate limits, 
            // but we build the tree. Content will be fetched on demand or for small repos.
            // For this demo, let's just build the tree structure.

            for (const item of treeData.tree) {
                if (item.type === 'blob') { // File
                    // Build tree logic similar to local
                    const parts = item.path.split('/');
                    let current = root;
                    for (let j = 0; j < parts.length; j++) {
                        const part = parts[j];
                        const isFile = j === parts.length - 1;
                        const path = item.path.split('/').slice(0, j + 1).join('/'); // Reconstruct path for consistency

                        let child = current.children?.find(c => c.name === part);
                        if (!child) {
                            child = {
                                id: path,
                                name: part,
                                type: isFile ? 'file' : 'directory',
                                path: path,
                                children: isFile ? undefined : []
                            };
                            current.children = current.children || [];
                            current.children.push(child);
                        }
                        current = child;
                    }
                }
            }

            setRootNode(root);
            // Note: fileMap is empty for GitHub initially. We need to fetch on click.
            setFileMap(newFileMap);
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

        // Flatten paths for AI
        const getAllPaths = (node: FileSystemNode): string[] => {
            let paths: string[] = [];
            if (node.type === 'file') paths.push(node.path);
            if (node.children) node.children.forEach(c => paths = paths.concat(getAllPaths(c)));
            return paths;
        };
        const allPaths = getAllPaths(rootNode);

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

    const handleNodeClick = async (node: FlatNode) => {
        setSelectedNode(node);

        // If it's a file and we haven't analyzed it yet, let's try to analyze it
        if (node.type === 'file') {
            // Check if we have content
            let content = fileMap.get(node.path);

            // If GitHub import, we might need to fetch content now
            if (!content && githubUrl) {
                const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
                if (match) {
                    const [_, owner, repo] = match;
                    try {
                        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${node.path}`);
                        const data = await res.json();
                        if (data.content) {
                            content = atob(data.content); // Decode Base64
                            setFileMap(prev => new Map(prev).set(node.path, content!));
                        }
                    } catch (e) { console.error("Failed to fetch file content", e); }
                }
            }

            if (content) {
                // Analyze structure if not present
                // Find the node in the tree to update it
                const updateTree = (n: FileSystemNode): boolean => {
                    if (n.path === node.path) {
                        if (!n.codeStructure) {
                            setStatus(AppStatus.ANALYZING_QUERY); // Reuse status
                            analyzeFileContent(content!, n.name).then(structure => {
                                n.codeStructure = structure;
                                // Force re-render of visualizer by creating new object ref
                                setRootNode(prev => prev ? { ...prev } : null);
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
            }
        }
    };

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
                        <CodeVisualizer
                            rootNode={rootNode}
                            highlightedPaths={highlightedPaths}
                            onNodeClick={handleNodeClick}
                        />
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
                                            onClick={() => {
                                                const content = fileMap.get(selectedNode.path);
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
