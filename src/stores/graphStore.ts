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

  buildGraph: (analysis: ProjectAnalysis) => void;
  onNodesChange: (changes: NodeChange<FlowUINode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowUIEdge>[]) => void;
  selectNode: (node: FlowUINode | null) => void;
  setFilters: (newFilters: Partial<GraphFilterState>) => void;
  toggleLayoutDirection: () => void;
  reset: () => void;
}

const DEFAULT_FILTERS: GraphFilterState = {
  searchQuery: '',
  showRoutes: true,
  showPages: true,
  showComponents: true,
  showActions: true,
  showHooks: false,  // start false to keep visual hierarchy clean
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

  buildGraph: (analysis) => {
    const { filters, layoutDirection } = get();
    const { nodes, edges } = buildGraphFromAnalysis(analysis, filters, layoutDirection);
    set({
      currentAnalysis: analysis,
      nodes,
      edges,
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
      const { nodes, edges } = buildGraphFromAnalysis(analysis, updatedFilters, get().layoutDirection);
      set({ nodes, edges });
    }
  },

  toggleLayoutDirection: () => {
    const nextDir = get().layoutDirection === 'LR' ? 'TB' : 'LR';
    set({ layoutDirection: nextDir });

    const analysis = get().currentAnalysis;
    if (analysis) {
      const { nodes, edges } = buildGraphFromAnalysis(analysis, get().filters, nextDir);
      set({ nodes, edges });
    }
  },

  reset: () => {
    set({
      nodes: [],
      edges: [],
      currentAnalysis: null,
      selectedNode: null,
      filters: DEFAULT_FILTERS,
    });
  },
}));
