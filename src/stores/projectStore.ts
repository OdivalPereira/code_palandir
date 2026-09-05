import { create } from 'zustand';
import type { ProjectFile, ProjectMeta } from '@/types/project';
import type { ProjectAnalysis } from '@/types/analysis';
import { analyzeProject } from '@/engine/analyzers';
import { useGraphStore } from './graphStore';

interface ProjectState {
  meta: ProjectMeta | null;
  files: ProjectFile[];
  analysis: ProjectAnalysis | null;
  isAnalyzing: boolean;
  error: string | null;

  setProject: (meta: ProjectMeta, files: ProjectFile[]) => void;
  runAnalysis: () => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  meta: null,
  files: [],
  analysis: null,
  isAnalyzing: false,
  error: null,

  setProject: (meta, files) => {
    set({ meta, files, error: null });
    get().runAnalysis();
  },

  runAnalysis: () => {
    const { files } = get();
    if (files.length === 0) return;

    set({ isAnalyzing: true, error: null });

    try {
      // Analyze project components, routes, and interactions
      const analysis = analyzeProject(files);
      set((state) => ({
        analysis,
        isAnalyzing: false,
        meta: state.meta ? { ...state.meta, framework: analysis.framework } : null,
      }));

      // Trigger graph building
      useGraphStore.getState().buildGraph(analysis);
    } catch (err: any) {
      console.error('Project analysis failed:', err);
      set({
        isAnalyzing: false,
        error: err?.message || 'Falha ao analisar o projeto',
      });
    }
  },

  reset: () => {
    set({
      meta: null,
      files: [],
      analysis: null,
      isAnalyzing: false,
      error: null,
    });
    useGraphStore.getState().reset();
  },
}));
