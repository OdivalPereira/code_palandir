import { create } from './zustand';
import {
  ClusterData,
  FileSystemNode,
  FlatNode,
  Link,
  GraphViewMode,
  SemanticLink,
  SessionGraphState,
  SessionSelectionState
} from '../types';

export type GraphState = {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  loadingPaths: Set<string>;
  selectedNodeId: string | null;
  expandedDirectories: Set<string>;
  layoutCache: { hash: string; positions: Record<string, { x: number; y: number }> } | null;
  sessionLayout: { hash: string; positions: Record<string, { x: number; y: number }> } | null;
  nodesById: Record<string, FlatNode>;
  linksById: Record<string, Link>;
  semanticLinksById: Record<string, SemanticLink>;
  graphViewMode: GraphViewMode;
  requestExpandNode: ((path: string) => void) | null;
  setRootNode: (rootNode: FileSystemNode | null) => void;
  updateRootNode: (updater: (current: FileSystemNode | null) => FileSystemNode | null) => void;
  setHighlightedPaths: (paths: string[]) => void;
  setLoadingPaths: (paths: Set<string>) => void;
  setSelectedNode: (nodeId: string | null) => void;
  expandDirectory: (path: string) => void;
  toggleDirectory: (path: string) => void;
  setRequestExpandNode: (handler: ((path: string) => void) | null) => void;
  restoreSession: (graph: SessionGraphState, selection: SessionSelectionState) => void;
  setLayoutCache: (hash: string, positions: Record<string, { x: number; y: number }>) => void;
  setSessionLayout: (layout: { hash: string; positions: Record<string, { x: number; y: number }> } | null) => void;
  setSemanticLinks: (links: SemanticLink[], sourceIds?: Set<string>) => void;
  setGraphViewMode: (mode: GraphViewMode) => void;
};

const buildGraphHashData = (
  rootNode: FileSystemNode | null,
  highlightedPaths: string[],
  expanded: Set<string>
): { nodesById: Record<string, FlatNode>; linksById: Record<string, Link> } => {
  if (!rootNode) return { nodesById: {}, linksById: {} };
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
    registerNode(clusterNode);
    registerLink(node.path, clusterId);
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
    registerNode(flatNode);

    if (parentId) {
      registerLink(parentId, node.path);
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
      registerNode(flatCodeNode);
      registerLink(node.path, codeId);
    });
  }
  };

  traverse(rootNode, null, 1);
  return { nodesById, linksById };
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
  selectedNodeId: null,
  expandedDirectories: new Set(),
  layoutCache: null,
  sessionLayout: null,
  nodesById: {},
  linksById: {},
  semanticLinksById: {},
  graphViewMode: 'structural',
  requestExpandNode: null,
  setRootNode: (rootNode) => {
    const expandedDirectories = rootNode ? new Set([rootNode.path]) : new Set();
    const { nodesById, linksById } = computeGraph(rootNode, get().highlightedPaths, expandedDirectories);
    set({
      rootNode,
      expandedDirectories,
      nodesById,
      linksById,
      selectedNodeId: null,
      layoutCache: null,
      semanticLinksById: {},
      graphViewMode: 'structural'
    });
  },
  updateRootNode: (updater) => {
    set((state) => {
      const nextRoot = updater(state.rootNode);
      const expandedDirectories = nextRoot
        ? (state.expandedDirectories.size ? state.expandedDirectories : new Set([nextRoot.path]))
        : new Set();
      const { nodesById, linksById } = computeGraph(nextRoot, state.highlightedPaths, expandedDirectories);
      return {
        rootNode: nextRoot,
        expandedDirectories,
        nodesById,
        linksById
      };
    });
  },
  setHighlightedPaths: (paths) => {
    const { rootNode, expandedDirectories } = get();
    const { nodesById, linksById } = computeGraph(rootNode, paths, expandedDirectories);
    set({ highlightedPaths: paths, nodesById, linksById });
  },
  setLoadingPaths: (paths) => set({ loadingPaths: paths }),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  expandDirectory: (path) => {
    set((state) => {
      if (state.expandedDirectories.has(path)) {
        return state;
      }
      const expandedDirectories = new Set(state.expandedDirectories);
      expandedDirectories.add(path);
      const { nodesById, linksById } = computeGraph(state.rootNode, state.highlightedPaths, expandedDirectories);
      return { expandedDirectories, nodesById, linksById };
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
      const { nodesById, linksById } = computeGraph(state.rootNode, state.highlightedPaths, expandedDirectories);
      return { expandedDirectories, nodesById, linksById };
    });
  },
  setRequestExpandNode: (handler) => set({ requestExpandNode: handler }),
  restoreSession: (graph, selection) => {
    const expandedDirectories = new Set(graph.expandedDirectories);
    const { nodesById, linksById } = computeGraph(graph.rootNode, graph.highlightedPaths, expandedDirectories);
    const nextSelected = selection.selectedNodeId && nodesById[selection.selectedNodeId]
      ? selection.selectedNodeId
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
      nodesById,
      linksById,
      selectedNodeId: nextSelected,
      layoutCache: null,
      semanticLinksById,
      graphViewMode: graph.graphViewMode ?? 'structural'
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
  setGraphViewMode: (mode) => set({ graphViewMode: mode })
}));
