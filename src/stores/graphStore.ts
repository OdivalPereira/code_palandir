import { create } from './zustand';
import { optimizePrompt } from '../api/client';
import {
  FileSystemNode,
  FlatNode,
  Link,
  GraphViewMode,
  SemanticLink,
  SessionGraphState,
  SessionSelectionState,
  UIIntentSchema,
} from '../types';

export type GraphState = {
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
  requestExpandNode: null,
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
  })
}));
