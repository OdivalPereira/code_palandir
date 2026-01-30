import { create } from './zustand';
import { ClusterData, FileSystemNode, FlatNode, Link } from '../types';

type GraphState = {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  loadingPaths: Set<string>;
  selectedNode: FlatNode | null;
  expandedDirectories: Set<string>;
  graphNodes: FlatNode[];
  graphLinks: Link[];
  requestExpandNode: ((path: string) => void) | null;
  setRootNode: (rootNode: FileSystemNode | null) => void;
  updateRootNode: (updater: (current: FileSystemNode | null) => FileSystemNode | null) => void;
  setHighlightedPaths: (paths: string[]) => void;
  setLoadingPaths: (paths: Set<string>) => void;
  setSelectedNode: (node: FlatNode | null) => void;
  expandDirectory: (path: string) => void;
  toggleDirectory: (path: string) => void;
  setRequestExpandNode: (handler: ((path: string) => void) | null) => void;
};

const buildGraphHashData = (
  rootNode: FileSystemNode | null,
  highlightedPaths: string[],
  expanded: Set<string>
): { nodes: FlatNode[]; links: Link[] } => {
  if (!rootNode) return { nodes: [], links: [] };
  const nodes: FlatNode[] = [];
  const links: Link[] = [];

  const countDescendants = (node: FileSystemNode): number => {
    if (typeof node.descendantCount === 'number') return node.descendantCount;
    if (!node.children || node.children.length === 0) return 0;
    return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
  };

  const addClusterNode = (node: FileSystemNode, depth: number) => {
    const childCount = countDescendants(node);
    const clusterId = `${node.path}::__cluster`;
    const clusterNode: FlatNode = {
      id: clusterId,
      name: `${childCount} items`,
      type: 'cluster',
      path: clusterId,
      group: depth + 1,
      relevant: false,
      data: {
        parentPath: node.path,
        childCount
      } as ClusterData,
      x: 0,
      y: 0
    };
    nodes.push(clusterNode);
    links.push({ source: node.path, target: clusterId });
  };

  const traverse = (node: FileSystemNode, parentId: string | null, depth: number) => {
    const flatNode: FlatNode = {
      id: node.path,
      name: node.name,
      type: node.type,
      path: node.path,
      group: depth,
      relevant: highlightedPaths.some(p => node.path.includes(p)),
      data: node,
      x: 0,
      y: 0
    };
    nodes.push(flatNode);

    if (parentId) {
      links.push({ source: parentId, target: node.path });
    }

    const hasChildren = (node.children && node.children.length > 0) || node.hasChildren;
    if (hasChildren) {
      const isExpanded = expanded.has(node.path);
      if (isExpanded && node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, node.path, depth + 1));
      } else {
        addClusterNode(node, depth);
      }
    }

    if (node.codeStructure) {
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

  traverse(rootNode, null, 1);
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
  setRootNode: (rootNode) => {
    const expandedDirectories = rootNode ? new Set([rootNode.path]) : new Set();
    const { nodes, links } = computeGraph(rootNode, get().highlightedPaths, expandedDirectories);
    set({
      rootNode,
      expandedDirectories,
      graphNodes: nodes,
      graphLinks: links,
      selectedNode: null
    });
  },
  updateRootNode: (updater) => {
    set((state) => {
      const nextRoot = updater(state.rootNode);
      const expandedDirectories = nextRoot
        ? (state.expandedDirectories.size ? state.expandedDirectories : new Set([nextRoot.path]))
        : new Set();
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
  setRequestExpandNode: (handler) => set({ requestExpandNode: handler })
}));
