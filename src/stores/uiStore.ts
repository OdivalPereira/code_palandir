import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeSidebarTab: 'detail' | 'prompt' | 'forensics';
  isImportModalOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: 'detail' | 'prompt' | 'forensics') => void;
  setImportModalOpen: (open: boolean) => void;
}

// Below md the side panel covers the whole graph, so it starts closed there.
function sidebarAbertaPorPadrao(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(min-width: 768px)').matches;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: sidebarAbertaPorPadrao(),
  activeSidebarTab: 'detail',
  isImportModalOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ activeSidebarTab: tab, sidebarOpen: true }),
  setImportModalOpen: (open) => set({ isImportModalOpen: open }),
}));
