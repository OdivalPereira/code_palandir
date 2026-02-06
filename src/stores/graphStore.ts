import { create } from './zustand';
import {
  analyzeFile,
  fetchAiMetrics,
  fetchSessionAccessToken,
  fetchUserRepos,
  GitHubRepo,
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
import { convertUIGraphToFlatNodes } from '../utils/uiGraphTransformer';
import type { BackendTemplate } from '../components/TemplateSidebar';
import {
  AiMetricsResponse,
  AppStatus,
  CodeNode,
  DetectedFramework,
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
  UINode,
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
  sidebarTab: 'prompt' | 'summary' | 'recommendations' | 'flow' | 'metrics' | 'library';
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
  allFilePaths: string[];
  localFileHandles: Map<string, File>;
  childrenIndex: Map<string, { path: string; name: string; type: 'directory' | 'file' }[]>;
  descendantCount: Map<string, number>;
  autoRestoreSignature: string | null;
  wizardTemplate: BackendTemplate | null;
  // Phase 1: Cache e Framework Detection
  projectFileContents: Map<string, string>;
  detectedFramework: DetectedFramework | null;
  frameworkStatus: 'idle' | 'detecting' | 'done' | 'error';
  githubOwnerRepo: { owner: string; repo: string; branch: string } | null;
  // Phase 1 + 2 + 4 Actions
  downloadProjectFiles: (paths: string[]) => Promise<void>;
  detectFramework: () => Promise<void>;
  buildUIGraph: () => Promise<void>;
  analyzeDependencies: () => Promise<void>;
  // Phase 5 Actions
  toggleMultiSelection: (nodeId: string) => void;
  clearMultiSelection: () => void;
  // Phase 5 State
  missingDependencies: MissingDependency[];
  selectedNodeIds: Set<string>;
  // Phase 2: UI Graph
  uiGraph: UINode | null;
  uiGraphStatus: 'idle' | 'loading' | 'done' | 'error';

  // UI actions
  setSearchQuery: (query: string) => void;
  setGithubUrl: (url: string) => void;
  setPromptOpen: (open: boolean) => void;
  setSidebarTab: (tab: 'prompt' | 'summary' | 'recommendations' | 'flow' | 'metrics' | 'library') => void;
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
  // User repos
  userRepos: GitHubRepo[];
  userReposStatus: 'idle' | 'loading' | 'error';
  fetchUserRepos: () => Promise<void>;
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
  optimizedPrompt: string | null;
  isOptimizing: boolean;
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
  optimizeIntent: (userIntent: string) => Promise<void>;
  clearOptimizedPrompt: () => void;
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
  selectedNodeIds: new Set(),
  allFilePaths: [],
  localFileHandles: new Map(),
  childrenIndex: new Map(),
  descendantCount: new Map(),
  autoRestoreSignature: null,
  wizardTemplate: null,
  // Phase 1: Cache e Framework Detection
  projectFileContents: new Map(),
  detectedFramework: null,
  frameworkStatus: 'idle',
  githubOwnerRepo: null,
  // Phase 2: UI Graph
  uiGraph: null,
  uiGraphStatus: 'idle',
  userRepos: [],
  userReposStatus: 'idle',
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
  fetchUserRepos: async () => {
    if (!get().isAuthenticated) {
      set({ authNotice: AUTH_NOTICE_MESSAGE });
      return;
    }
    set({ userReposStatus: 'loading' });
    try {
      const repos = await fetchUserRepos();
      set({ userRepos: repos, userReposStatus: 'idle' });
    } catch (error) {
      console.error(error);
      set({ userReposStatus: 'error' });
    }
  },
  // Phase 1: Download project files content from GitHub
  downloadProjectFiles: async (paths: string[]) => {
    const { githubOwnerRepo, projectFileContents } = get();
    if (!githubOwnerRepo) return;

    const { owner, repo, branch } = githubOwnerRepo;
    const newContents = new Map(projectFileContents);

    for (const filePath of paths) {
      try {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          newContents.set(filePath, content);
        }
      } catch (error) {
        console.warn(`Failed to download ${filePath}:`, error);
      }
    }

    set({ projectFileContents: newContents });
  },
  // Phase 1: Detect framework via AI
  detectFramework: async () => {
    const { projectFileContents, isAuthenticated } = get();
    if (!isAuthenticated) {
      console.warn('User not authenticated, skipping framework detection');
      return;
    }

    set({ frameworkStatus: 'detecting', status: AppStatus.DETECTING_FRAMEWORK });

    try {
      // Prepare payload for backend
      const packageJsonContent = projectFileContents.get('package.json') || '';
      const entryFiles: Array<{ path: string; content: string }> = [];

      // Get key frontend files
      const frontendPatterns = [
        /^src\/(index|main|App)\.(ts|tsx|js|jsx)$/,
        /^(index|main|App)\.(ts|tsx|js|jsx)$/,
        /\.vue$/,
        /\.svelte$/
      ];

      for (const [path, content] of projectFileContents.entries()) {
        if (frontendPatterns.some(p => p.test(path)) && entryFiles.length < 5) {
          entryFiles.push({ path, content: content.slice(0, 2000) }); // Limit size
        }
      }

      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const response = await fetch(`${baseUrl}/api/analyze/detect-framework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ packageJson: packageJsonContent, entryFiles })
      });

      if (!response.ok) {
        throw new Error('Framework detection failed');
      }

      const data = await response.json();
      set({
        detectedFramework: data.framework,
        frameworkStatus: 'done',
        status: AppStatus.IDLE
      });

      // Auto-trigger UI Graph build after detection
      get().buildUIGraph();

    } catch (error) {
      console.error('Framework detection error:', error);
      set({ frameworkStatus: 'error', status: AppStatus.IDLE });
    }
  },

  // Phase 2: Build UI Graph via AI
  buildUIGraph: async () => {
    const { projectFileContents, detectedFramework, isAuthenticated } = get();
    if (!isAuthenticated || !detectedFramework) return;

    set({ uiGraphStatus: 'loading' });

    try {
      const files: Array<{ path: string; content: string }> = [];

      // Filter relevant files based on framework
      const uiPatterns = [
        /\.(tsx|jsx|vue|svelte)$/, // Components
        /src\/.*\.(js|ts)$/        // Potential logic/utils
      ];

      // Basic size limit protection
      let totalSize = 0;
      const MAX_SIZE = 150000; // 150KB payload limit

      for (const [path, content] of projectFileContents.entries()) {
        if (uiPatterns.some(p => p.test(path))) {
          if (totalSize + content.length < MAX_SIZE) {
            files.push({ path, content });
            totalSize += content.length;
          }
        }
      }

      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const response = await fetch(`${baseUrl}/api/analyze/ui-hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          framework: detectedFramework.name,
          files,
          entryPoint: detectedFramework.entryPoint
        })
      });

      if (!response.ok) {
        throw new Error('UI Graph build failed');
      }

      const data = await response.json();
      const { nodes, links } = convertUIGraphToFlatNodes(data.graph.root, get().missingDependencies);
      const nodesById: Record<string, FlatNode> = {};
      for (const node of nodes) {
        nodesById[node.id] = node;
      }
      const linksById: Record<string, Link> = {};
      for (const link of links) {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        const linkId = `${sourceId}->${targetId}:${link.kind ?? 'structural'}`;
        linksById[linkId] = { ...link, source: sourceId, target: targetId };
      }

      set({
        uiGraph: data.graph.root,
        uiGraphStatus: 'done',
        nodes,
        links,
        nodesById,
        linksById,
        graphViewMode: 'ui'
      });
      console.log('UI Graph built:', data.graph);

      // Auto-trigger dependency analysis after UI graph is built
      get().analyzeDependencies();

    } catch (error) {
      console.error('UI Graph build error:', error);
      set({ uiGraphStatus: 'error' });
    }
  },

  analyzeDependencies: async () => {
    const { projectFileContents, detectedFramework, isAuthenticated } = get();
    if (!isAuthenticated || !detectedFramework) return;

    // Check if we haven't already analyzed (avoid loops unless forced)
    // For now we run it every time buildUIGraph finishes

    console.log('Starting Dependency Analysis...');

    try {
      const frontendFiles: Array<{ path: string; content: string }> = [];
      const backendFiles: Array<{ path: string; content: string }> = [];

      // Filter frontend files (same as UI graph + stores/services)
      const frontendPatterns = [
        /\.(tsx|jsx|vue|svelte)$/,
        /src\/.*\.ts$/,
        /src\/services\/.*\.ts$/,
        /src\/api\/.*\.ts$/
      ];

      // Filter backend files (if any exist in repo)
      const backendPatterns = [
        /^server\/.*\.js|ts$/,
        /^backend\/.*\.js|ts$/,
        /^api\/.*\.js|ts$/,
        /route\.ts$/ // Next.js API routes
      ];

      let totalSize = 0;
      const MAX_SIZE = 150000; // Shared payload limit

      for (const [path, content] of projectFileContents.entries()) {
        const isFrontend = frontendPatterns.some(p => p.test(path));
        const isBackend = backendPatterns.some(p => p.test(path));

        if ((isFrontend || isBackend) && totalSize + content.length < MAX_SIZE) {
          if (isFrontend) frontendFiles.push({ path, content });
          if (isBackend) backendFiles.push({ path, content });
          totalSize += content.length;
        }
      }

      const baseUrl = import.meta.env.VITE_SERVER_URL || '';
      const response = await fetch(`${baseUrl}/api/analyze/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          framework: detectedFramework.name,
          frontendFiles,
          backendFiles
        })
      });

      if (!response.ok) {
        throw new Error('Dependency analysis failed');
      }

      const data = await response.json();
      // Map analysis to MissingDependency format
      // Ideally we should update a new state store for dependencies
      console.log('Dependency Analysis Result:', data.analysis);

      set({
        missingDependencies: data.analysis || []
      });

    } catch (error) {
      console.error('Dependency analysis error:', error);
    }
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
    // Phase 5 Initial State
    const initialState: Partial<GraphState> = {
      projectFileContents: new Map(),
      detectedFramework: null,
      frameworkStatus: 'idle',
      githubOwnerRepo: null,
      uiGraph: null,
      uiGraphStatus: 'idle',
      missingDependencies: [],
      selectedNodeIds: new Set(),
      // ... existing initial states ...
    };

    set({
      ...initialState,
      fileMap: new Map(),
      moduleInputs: [],
      missingDependencies: [],
      selectedNodeIds: new Set(),
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

    // Auto-analyze key entry files to build semantic links
    const keyFilePatterns = [
      /^[^/]+\/(index|main|App)\.(ts|tsx|js|jsx)$/,
      /^[^/]+\/stores\/.*\.(ts|tsx)$/,
      /^[^/]+\/components\/App.*\.(ts|tsx)$/
    ];
    const keyFiles = allPaths.filter((p: string) =>
      keyFilePatterns.some((pattern) => pattern.test(p))
    ).slice(0, 5);

    if (keyFiles.length > 0 && get().isAuthenticated) {
      console.log('Auto-analyzing key files:', keyFiles);
      for (const filePath of keyFiles) {
        try {
          await get().ensureFileContent(filePath);
        } catch (error) {
          console.warn(`Failed to auto-analyze ${filePath}:`, error);
        }
      }
    }

    await get().detectFramework();
  },

  toggleMultiSelection: (nodeId: string) => {
    const { selectedNodeIds } = get();
    const next = new Set(selectedNodeIds);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    set({ selectedNodeIds: next });
  },

  clearMultiSelection: () => {
    set({ selectedNodeIds: new Set() });
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
        allFilePaths: paths,
        // Phase 1: Save GitHub owner/repo for file downloads
        githubOwnerRepo: { owner, repo, branch: defaultBranch },
        projectFileContents: new Map(),
        detectedFramework: null,
        frameworkStatus: 'idle'
      });

      const signature = await computeProjectSignature(paths, `github:${owner}/${repo}`);
      set({ projectSignature: signature });
      await get().tryRestoreSavedSession(signature);

      // Phase 1: Download key files and detect framework
      if (get().isAuthenticated) {
        // Files to download for framework detection
        const filesToDownload = [
          'package.json',
          ...paths.filter((p: string) =>
            /^(src\/)?(index|main|App)\.(ts|tsx|js|jsx)$/.test(p) ||
            /\.(vue|svelte)$/.test(p) ||
            /^(vite|next|angular)\.config\.(js|ts|mjs)$/.test(p)
          ).slice(0, 10)
        ];

        console.log('Phase 1: Downloading key files...', filesToDownload);
        await get().downloadProjectFiles(filesToDownload);

        console.log('Phase 1: Detecting framework...');
        await get().detectFramework();
      }
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
  optimizedPrompt: null,
  isOptimizing: false,
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
      flowPathLinkIds: new Set(),
      // Phase 5 restore logic could go here
      missingDependencies: [],
      selectedNodeIds: new Set()
    });
  },

  setLayoutCache: (hash, positions) => set({ layoutCache: { hash, positions } }),
  setSessionLayout: (layout) => set({ sessionLayout: layout }),

  setSemanticLinks: (links, sourceIds) => {
    set((state) => {
      const nextLinks = { ...state.semanticLinksById };

      // Remove old links for this source
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
  },

  optimizeIntent: async (userIntent) => {
    const { selectedNode, ensureFileContent } = get();
    if (!selectedNode) {
      set({ optimizedPrompt: 'Selecione um nó antes de otimizar o prompt.', isOptimizing: false });
      return;
    }

    set({ isOptimizing: true, optimizedPrompt: null });

    try {
      // Get the file content for the selected node
      let fileContent = '';
      if (selectedNode.type === 'file') {
        fileContent = await ensureFileContent(selectedNode.path) || '';
      }

      const response = await fetch('/api/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userIntent,
          selectedNode: {
            id: selectedNode.id,
            name: selectedNode.name,
            path: selectedNode.path,
            type: selectedNode.type,
          },
          fileContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json() as { prompt?: string };
      set({ optimizedPrompt: data.prompt || '', isOptimizing: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao otimizar o prompt.';
      set({ optimizedPrompt: message, isOptimizing: false });
    }
  },

  clearOptimizedPrompt: () => set({ optimizedPrompt: null, isOptimizing: false }),
}));
