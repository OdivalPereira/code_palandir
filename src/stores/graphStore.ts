import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { FlowUINode, FlowUIEdge, GraphFilterState, SerializedGraphBundle } from '@/types/graph';
import type { ProjectAnalysis } from '@/types/analysis';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { auditGraphForensics, type GraphForensicsReport } from '@/engine/graphForensics';
import { useProjectStore } from './projectStore';

interface GraphState {
  nodes: FlowUINode[];
  edges: FlowUIEdge[];
  currentAnalysis: ProjectAnalysis | null;
  filters: GraphFilterState;
  selectedNode: FlowUINode | null;
  layoutDirection: 'TB' | 'LR';
  expandedNodeIds: Set<string>;
  expansionLevel: 1 | 2 | 3;

  buildGraph: (analysis: ProjectAnalysis) => void;
  onNodesChange: (changes: NodeChange<FlowUINode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowUIEdge>[]) => void;
  selectNode: (node: FlowUINode | null) => void;
  setFilters: (newFilters: Partial<GraphFilterState>) => void;
  toggleLayoutDirection: () => void;
  toggleNodeExpanded: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setExpansionLevel: (level: 1 | 2 | 3) => void;
  reset: () => void;
  exportGraphBundle: () => SerializedGraphBundle;
  importGraphBundle: (bundle: unknown) => { success: boolean; error?: string };
  auditIntegrity: () => GraphForensicsReport;
}

const DEFAULT_FILTERS: GraphFilterState = {
  searchQuery: '',
  showRoutes: true,
  showPages: true,
  showComponents: true,
  showActions: true,
  showHooks: false, // start false to keep visual hierarchy clean
  showStores: true,
  showApis: true,
};

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  currentAnalysis: null,
  filters: DEFAULT_FILTERS,
  selectedNode: null,
  layoutDirection: 'LR',
  expandedNodeIds: new Set<string>(),
  expansionLevel: 1,

  buildGraph: (analysis) => {
    const { filters, layoutDirection } = get();
    // Collapsed by default: initial expandedNodeIds is empty set
    const initialExpanded = new Set<string>();
    const { nodes, edges } = buildGraphFromAnalysis(analysis, filters, layoutDirection, initialExpanded);
    set({
      currentAnalysis: analysis,
      nodes,
      edges,
      expandedNodeIds: initialExpanded,
      expansionLevel: 1,
    });
  },

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  selectNode: (node) => {
    set({ selectedNode: node });
  },

  setFilters: (newFilters) => {
    const updatedFilters = { ...get().filters, ...newFilters };
    set({ filters: updatedFilters });

    const analysis = get().currentAnalysis;
    if (analysis) {
      const { nodes, edges } = buildGraphFromAnalysis(
        analysis,
        updatedFilters,
        get().layoutDirection,
        get().expandedNodeIds
      );
      set({ nodes, edges });
    }
  },

  toggleLayoutDirection: () => {
    const nextDir = get().layoutDirection === 'LR' ? 'TB' : 'LR';
    set({ layoutDirection: nextDir });

    const analysis = get().currentAnalysis;
    if (analysis) {
      const { nodes, edges } = buildGraphFromAnalysis(
        analysis,
        get().filters,
        nextDir,
        get().expandedNodeIds
      );
      set({ nodes, edges });
    }
  },

  toggleNodeExpanded: (nodeId: string) => {
    const { currentAnalysis, filters, layoutDirection, expandedNodeIds } = get();
    if (!currentAnalysis) return;

    const nextExpanded = new Set(expandedNodeIds);
    if (nextExpanded.has(nodeId)) {
      nextExpanded.delete(nodeId);
    } else {
      nextExpanded.add(nodeId);
    }

    const { nodes, edges } = buildGraphFromAnalysis(
      currentAnalysis,
      filters,
      layoutDirection,
      nextExpanded
    );

    set({
      expandedNodeIds: nextExpanded,
      nodes,
      edges,
    });
  },

  expandNode: (nodeId: string) => {
    const { currentAnalysis, filters, layoutDirection, expandedNodeIds } = get();
    if (!currentAnalysis || expandedNodeIds.has(nodeId)) return;

    const nextExpanded = new Set(expandedNodeIds);
    nextExpanded.add(nodeId);

    const { nodes, edges } = buildGraphFromAnalysis(
      currentAnalysis,
      filters,
      layoutDirection,
      nextExpanded
    );

    set({
      expandedNodeIds: nextExpanded,
      nodes,
      edges,
    });
  },

  collapseNode: (nodeId: string) => {
    const { currentAnalysis, filters, layoutDirection, expandedNodeIds } = get();
    if (!currentAnalysis || !expandedNodeIds.has(nodeId)) return;

    const nextExpanded = new Set(expandedNodeIds);
    nextExpanded.delete(nodeId);

    const { nodes, edges } = buildGraphFromAnalysis(
      currentAnalysis,
      filters,
      layoutDirection,
      nextExpanded
    );

    set({
      expandedNodeIds: nextExpanded,
      nodes,
      edges,
    });
  },

  collapseAll: () => {
    const { currentAnalysis, filters, layoutDirection } = get();
    if (!currentAnalysis) return;

    const nextExpanded = new Set<string>();
    const { nodes, edges } = buildGraphFromAnalysis(
      currentAnalysis,
      filters,
      layoutDirection,
      nextExpanded
    );

    set({
      expandedNodeIds: nextExpanded,
      nodes,
      edges,
      expansionLevel: 1,
    });
  },

  expandAll: () => {
    const { currentAnalysis, filters, layoutDirection } = get();
    if (!currentAnalysis) return;

    const nextExpanded = new Set<string>();
    for (const p of currentAnalysis.pages) {
      nextExpanded.add(`node-page-${p.id}`);
    }
    for (const c of currentAnalysis.components) {
      nextExpanded.add(`node-comp-${c.id}`);
    }

    const { nodes, edges } = buildGraphFromAnalysis(
      currentAnalysis,
      filters,
      layoutDirection,
      nextExpanded
    );

    set({
      expandedNodeIds: nextExpanded,
      nodes,
      edges,
      expansionLevel: 3,
    });
  },

  setExpansionLevel: (level: 1 | 2 | 3) => {
    const { currentAnalysis, filters, layoutDirection } = get();
    if (!currentAnalysis) return;

    const nextExpanded = new Set<string>();
    if (level === 1) {
      // Level 1: Only Entry Points (Routes and Pages), everything collapsed
    } else if (level === 2) {
      // Level 2: Pages and entry components expanded to show direct components, components themselves collapsed
      for (const p of currentAnalysis.pages) {
        nextExpanded.add(`node-page-${p.id}`);
      }
      if (currentAnalysis.pages.length === 0) {
        const allRendered = new Set<string>();
        for (const c of currentAnalysis.components) {
          for (const ch of c.childrenNames) allRendered.add(ch);
        }
        for (const c of currentAnalysis.components) {
          if (!allRendered.has(c.name)) {
            nextExpanded.add(`node-comp-${c.id}`);
          }
        }
      }
    } else if (level === 3) {
      // Level 3: Everything expanded
      for (const p of currentAnalysis.pages) {
        nextExpanded.add(`node-page-${p.id}`);
      }
      for (const c of currentAnalysis.components) {
        nextExpanded.add(`node-comp-${c.id}`);
      }
    }

    const { nodes, edges } = buildGraphFromAnalysis(
      currentAnalysis,
      filters,
      layoutDirection,
      nextExpanded
    );

    set({
      expandedNodeIds: nextExpanded,
      nodes,
      edges,
      expansionLevel: level,
    });
  },

  reset: () => {
    set({
      nodes: [],
      edges: [],
      currentAnalysis: null,
      selectedNode: null,
      filters: DEFAULT_FILTERS,
      expandedNodeIds: new Set<string>(),
      expansionLevel: 1,
    });
  },

  exportGraphBundle: (): SerializedGraphBundle => {
    const state = get();
    let projectName: string | undefined;
    let framework: string | undefined = state.currentAnalysis?.framework;

    try {
      const projectMeta = useProjectStore.getState().meta;
      if (projectMeta) {
        if (projectMeta.name) projectName = projectMeta.name;
        if (!framework && projectMeta.framework) framework = projectMeta.framework;
      }
    } catch {
      // safe fallback if projectStore cannot be accessed
    }

    const meta = (projectName || framework) ? {
      ...(projectName ? { projectName } : {}),
      ...(framework ? { framework } : {}),
    } : undefined;

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      ...(meta ? { meta } : {}),
      filters: { ...state.filters },
      layoutDirection: state.layoutDirection,
      expansionLevel: state.expansionLevel,
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    };
  },

  importGraphBundle: (bundle: unknown): { success: boolean; error?: string } => {
    let data: any = bundle;

    if (typeof bundle === 'string') {
      try {
        data = JSON.parse(bundle);
      } catch (err: any) {
        return {
          success: false,
          error: `Falha ao interpretar JSON do bundle: ${err?.message || 'JSON inválido'}`,
        };
      }
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        success: false,
        error: 'Bundle inválido: esperado um objeto contendo os dados do grafo',
      };
    }

    if (data.version !== '1.0.0') {
      return {
        success: false,
        error: `Versão de bundle incompatível: "${data.version}". Versão esperada: "1.0.0"`,
      };
    }

    if (typeof data.exportedAt !== 'string' || !data.exportedAt.trim()) {
      return {
        success: false,
        error: 'Campo "exportedAt" ausente ou inválido no bundle',
      };
    }

    if (data.layoutDirection !== 'TB' && data.layoutDirection !== 'LR') {
      return {
        success: false,
        error: `layoutDirection inválido: "${data.layoutDirection}". Valores aceitos: "TB" ou "LR"`,
      };
    }

    if (data.expansionLevel !== 1 && data.expansionLevel !== 2 && data.expansionLevel !== 3) {
      return {
        success: false,
        error: `expansionLevel inválido: "${data.expansionLevel}". Valores aceitos: 1, 2 ou 3`,
      };
    }

    if (!data.filters || typeof data.filters !== 'object' || Array.isArray(data.filters)) {
      return {
        success: false,
        error: 'Campo "filters" ausente ou inválido no bundle',
      };
    }

    if (typeof data.filters.searchQuery !== 'string') {
      return {
        success: false,
        error: 'filters.searchQuery deve ser uma string',
      };
    }

    const booleanFilterKeys = [
      'showRoutes',
      'showPages',
      'showComponents',
      'showActions',
      'showHooks',
      'showStores',
      'showApis',
    ] as const;

    for (const key of booleanFilterKeys) {
      if (typeof data.filters[key] !== 'boolean') {
        return {
          success: false,
          error: `Filtro "${key}" ausente ou inválido: esperado booleano`,
        };
      }
    }

    if (!Array.isArray(data.nodes)) {
      return {
        success: false,
        error: 'Campo "nodes" deve ser um array de nós',
      };
    }

    const nodeIds = new Set<string>();
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        return {
          success: false,
          error: `Nó no índice ${i} deve ser um objeto válido`,
        };
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        return {
          success: false,
          error: `Nó no índice ${i} possui ID ausente ou vazio`,
        };
      }
      if (nodeIds.has(node.id)) {
        return {
          success: false,
          error: `ID de nó duplicado encontrado: "${node.id}"`,
        };
      }
      nodeIds.add(node.id);

      if (
        !node.position ||
        typeof node.position !== 'object' ||
        typeof node.position.x !== 'number' ||
        typeof node.position.y !== 'number' ||
        Number.isNaN(node.position.x) ||
        Number.isNaN(node.position.y)
      ) {
        return {
          success: false,
          error: `Nó "${node.id}" possui coordenadas position {x, y} inválidas`,
        };
      }

      if (!node.data || typeof node.data !== 'object' || Array.isArray(node.data)) {
        return {
          success: false,
          error: `Nó "${node.id}" possui dados (data) ausentes ou inválidos`,
        };
      }

      if (typeof node.data.id !== 'string' || typeof node.data.label !== 'string') {
        return {
          success: false,
          error: `Nó "${node.id}" data deve conter "id" e "label" válidos`,
        };
      }
    }

    if (!Array.isArray(data.edges)) {
      return {
        success: false,
        error: 'Campo "edges" deve ser um array de arestas',
      };
    }

    const edgeIds = new Set<string>();
    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i];
      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        return {
          success: false,
          error: `Aresta no índice ${i} deve ser um objeto válido`,
        };
      }
      if (typeof edge.id !== 'string' || !edge.id.trim()) {
        return {
          success: false,
          error: `Aresta no índice ${i} possui ID ausente ou vazio`,
        };
      }
      if (edgeIds.has(edge.id)) {
        return {
          success: false,
          error: `ID de aresta duplicado encontrado: "${edge.id}"`,
        };
      }
      edgeIds.add(edge.id);

      if (typeof edge.source !== 'string' || !edge.source.trim()) {
        return {
          success: false,
          error: `Aresta "${edge.id}" possui "source" ausente ou inválido`,
        };
      }
      if (typeof edge.target !== 'string' || !edge.target.trim()) {
        return {
          success: false,
          error: `Aresta "${edge.id}" possui "target" ausente ou inválido`,
        };
      }

      if (!nodeIds.has(edge.source)) {
        return {
          success: false,
          error: `Integridade referencial violada: aresta "${edge.id}" aponta para source inexistente "${edge.source}"`,
        };
      }
      if (!nodeIds.has(edge.target)) {
        return {
          success: false,
          error: `Integridade referencial violada: aresta "${edge.id}" aponta para target inexistente "${edge.target}"`,
        };
      }
    }

    if (data.meta !== undefined) {
      if (!data.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) {
        return {
          success: false,
          error: 'Campo "meta" opcional deve ser um objeto',
        };
      }
      if (data.meta.projectName !== undefined && typeof data.meta.projectName !== 'string') {
        return {
          success: false,
          error: 'meta.projectName deve ser uma string',
        };
      }
      if (data.meta.framework !== undefined && typeof data.meta.framework !== 'string') {
        return {
          success: false,
          error: 'meta.framework deve ser uma string',
        };
      }
    }

    const clonedNodes: FlowUINode[] = JSON.parse(JSON.stringify(data.nodes));
    const clonedEdges: FlowUIEdge[] = JSON.parse(JSON.stringify(data.edges));
    const clonedFilters: GraphFilterState = {
      searchQuery: data.filters.searchQuery,
      showRoutes: data.filters.showRoutes,
      showPages: data.filters.showPages,
      showComponents: data.filters.showComponents,
      showActions: data.filters.showActions,
      showHooks: data.filters.showHooks,
      showStores: data.filters.showStores,
      showApis: data.filters.showApis,
    };

    const expandedNodeIds = new Set<string>();
    for (const node of clonedNodes) {
      if (node.data?.isExpanded || node.data?.expanded) {
        expandedNodeIds.add(node.id);
      }
    }

    set({
      nodes: clonedNodes,
      edges: clonedEdges,
      filters: clonedFilters,
      layoutDirection: data.layoutDirection,
      expansionLevel: data.expansionLevel,
      expandedNodeIds,
      selectedNode: null,
    });

    return { success: true };
  },

  auditIntegrity: (): GraphForensicsReport => {
    return auditGraphForensics(get().nodes, get().edges);
  },
}));
