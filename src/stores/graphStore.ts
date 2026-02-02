import { create } from './zustand';
import { ClusterData, FileSystemNode, FlatNode, Link, MissingDependency, BackendRequirements } from '../types';

type GraphState = {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  loadingPaths: Set<string>;
  selectedNode: FlatNode | null;
  expandedDirectories: Set<string>;
  graphNodes: FlatNode[];
  graphLinks: Link[];
  requestExpandNode: ((path: string) => void) | null;
  // Ghost nodes for Reverse Dependency Mapping
  ghostNodes: FlatNode[];
  ghostLinks: Link[];
  missingDependencies: MissingDependency[];
  backendRequirements: BackendRequirements | null;
  isAnalyzingIntent: boolean;
  // Actions
  setRootNode: (rootNode: FileSystemNode | null) => void;
  updateRootNode: (updater: (current: FileSystemNode | null) => FileSystemNode | null) => void;
  setHighlightedPaths: (paths: string[]) => void;
  setLoadingPaths: (paths: Set<string>) => void;
  setSelectedNode: (node: FlatNode | null) => void;
  expandDirectory: (path: string) => void;
  toggleDirectory: (path: string) => void;
  setRequestExpandNode: (handler: ((path: string) => void) | null) => void;
  // Ghost node actions
  setGhostNodes: (nodes: FlatNode[], links: Link[]) => void;
  clearGhostNodes: () => void;
  setMissingDependencies: (deps: MissingDependency[], requirements: BackendRequirements) => void;
  setIsAnalyzingIntent: (isAnalyzing: boolean) => void;
};

const buildGraphHashData = (
  rootNode: FileSystemNode | null,
  highlightedPaths: string[],
  expanded: Set<string>
): { nodes: FlatNode[]; links: Link[] } => {
  if (!rootNode) return { nodes: [], links: [] };
  const nodes: FlatNode[] = [];
  const links: Link[] = [];

  const traverse = (node: FileSystemNode, parentId: string | null, depth: number) => {
    // Check if directory is collapsed (not in expanded set)
    // Root is always expanded by default
    const isExpanded = expanded.has(node.path) || node.path === '';
    const hasChildren = (node.children && node.children.length > 0) || node.hasChildren;

    // Calculate total descendants for badge
    const countDescendants = (n: FileSystemNode): number => {
      if (typeof n.descendantCount === 'number') return n.descendantCount;
      if (!n.children || n.children.length === 0) return 0;
      return n.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
    };

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
    nodes.push(flatNode);

    if (parentId !== null) {
      links.push({ source: parentId, target: node.path });
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
        nodes.push(flatCodeNode);
        links.push({ source: node.path, target: codeId });
      });
    }
  };

  if (rootNode) {
    // Ensure root is in expanded set initially effectively
    expanded.add(rootNode.path);
    traverse(rootNode, null, 1);
  }

  return { nodes, links };
};

const computeGraph = (
  rootNode: FileSystemNode | null,
  highlightedPaths: string[],
  expandedDirectories: Set<string>
) => buildGraphHashData(rootNode, highlightedPaths, expandedDirectories);

export const useGraphStore = create<GraphState>((set, get) => ({
  rootNode: null,
  highlightedPaths: [],
  loadingPaths: new Set(),
  selectedNode: null,
  expandedDirectories: new Set(),
  graphNodes: [],
  graphLinks: [],
  requestExpandNode: null,
  // Ghost node initial state
  ghostNodes: [],
  ghostLinks: [],
  missingDependencies: [],
  backendRequirements: null,
  isAnalyzingIntent: false,
  setRootNode: (rootNode) => {
    const expandedDirectories = rootNode ? new Set<string>([rootNode.path]) : new Set<string>();
    const { nodes, links } = computeGraph(rootNode, get().highlightedPaths, expandedDirectories);
    set({
      rootNode,
      expandedDirectories,
      graphNodes: nodes,
      graphLinks: links,
      selectedNode: null,
      // Clear ghost nodes when changing root
      ghostNodes: [],
      ghostLinks: [],
      missingDependencies: [],
      backendRequirements: null,
    });
  },
  updateRootNode: (updater) => {
    set((state) => {
      const nextRoot = updater(state.rootNode);
      const expandedDirectories = nextRoot
        ? (state.expandedDirectories.size ? state.expandedDirectories : new Set<string>([nextRoot.path]))
        : new Set<string>();
      const { nodes, links } = computeGraph(nextRoot, state.highlightedPaths, expandedDirectories);
      return {
        rootNode: nextRoot,
        expandedDirectories,
        graphNodes: nodes,
        graphLinks: links
      };
    });
  },
  setHighlightedPaths: (paths) => {
    const { rootNode, expandedDirectories } = get();
    const { nodes, links } = computeGraph(rootNode, paths, expandedDirectories);
    set({ highlightedPaths: paths, graphNodes: nodes, graphLinks: links });
  },
  setLoadingPaths: (paths) => set({ loadingPaths: paths }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  expandDirectory: (path) => {
    set((state) => {
      if (state.expandedDirectories.has(path)) {
        return state;
      }
      const expandedDirectories = new Set(state.expandedDirectories);
      expandedDirectories.add(path);
      const { nodes, links } = computeGraph(state.rootNode, state.highlightedPaths, expandedDirectories);
      return { expandedDirectories, graphNodes: nodes, graphLinks: links };
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
      const { nodes, links } = computeGraph(state.rootNode, state.highlightedPaths, expandedDirectories);
      return { expandedDirectories, graphNodes: nodes, graphLinks: links };
    });
  },
  setRequestExpandNode: (handler) => set({ requestExpandNode: handler }),
  // Ghost node actions
  setGhostNodes: (nodes, links) => set({ ghostNodes: nodes, ghostLinks: links }),
  clearGhostNodes: () => set({
    ghostNodes: [],
    ghostLinks: [],
    missingDependencies: [],
    backendRequirements: null,
  }),
  setMissingDependencies: (deps, requirements) => set({
    missingDependencies: deps,
    backendRequirements: requirements,
  }),
  setIsAnalyzingIntent: (isAnalyzing) => set({ isAnalyzingIntent: isAnalyzing }),
}));
