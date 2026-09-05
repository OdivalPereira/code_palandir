import { create } from 'zustand';
import type { SelectedElement } from '@/types/prompt';

interface SelectionState {
  selectedElements: SelectedElement[];

  toggleElement: (element: SelectedElement) => void;
  addElement: (element: SelectedElement) => void;
  removeElement: (id: string) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedElements: [],

  toggleElement: (element) => {
    const exists = get().selectedElements.some(e => e.id === element.id);
    if (exists) {
      set({
        selectedElements: get().selectedElements.filter(e => e.id !== element.id),
      });
    } else {
      set({
        selectedElements: [...get().selectedElements, element],
      });
    }
  },

  addElement: (element) => {
    if (!get().selectedElements.some(e => e.id === element.id)) {
      set({
        selectedElements: [...get().selectedElements, element],
      });
    }
  },

  removeElement: (id) => {
    set({
      selectedElements: get().selectedElements.filter(e => e.id !== id),
    });
  },

  clearSelection: () => {
    set({ selectedElements: [] });
  },

  isSelected: (id) => {
    return get().selectedElements.some(e => e.id === id);
  },
}));
