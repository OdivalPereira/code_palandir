import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { FlowUINode, FlowUIEdge, GraphFilterState } from '@/types/graph';
import type { ProjectAnalysis } from '@/types/analysis';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';

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
}));
