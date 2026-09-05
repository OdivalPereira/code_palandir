import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeSidebarTab: 'detail' | 'prompt';
  isImportModalOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: 'detail' | 'prompt') => void;
  setImportModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeSidebarTab: 'detail',
  isImportModalOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarTab: (tab) => set({ activeSidebarTab: tab, sidebarOpen: true }),
  setImportModalOpen: (open) => set({ isImportModalOpen: open }),
}));
