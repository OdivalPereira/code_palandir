import { create } from 'zustand';
import type { SelectedElement } from '@/types/prompt';

interface SelectionState {
  selectedElements: SelectedElement[];

  toggleElement: (element: SelectedElement) => void;
  addElement: (element: SelectedElement) => void;
  addElements: (elements: SelectedElement[]) => void;
  removeElement: (id: string) => void;
  removeElements: (ids: string[]) => void;
  toggleGroup: (elements: SelectedElement[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  isGroupSelected: (ids: string[]) => boolean;
  isGroupPartiallySelected: (ids: string[]) => boolean;
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

  addElements: (elements) => {
    const current = get().selectedElements;
    const currentIds = new Set(current.map(e => e.id));
    const seenNew = new Set<string>();
    const toAdd: SelectedElement[] = [];
    for (const el of elements) {
      if (!currentIds.has(el.id) && !seenNew.has(el.id)) {
        seenNew.add(el.id);
        toAdd.push(el);
      }
    }
    if (toAdd.length > 0) {
      set({
        selectedElements: [...current, ...toAdd],
      });
    }
  },

  removeElement: (id) => {
    set({
      selectedElements: get().selectedElements.filter(e => e.id !== id),
    });
  },

  removeElements: (ids) => {
    const idSet = new Set(ids);
    set({
      selectedElements: get().selectedElements.filter(e => !idSet.has(e.id)),
    });
  },

  toggleGroup: (elements) => {
    if (elements.length === 0) return;
    const current = get().selectedElements;
    const currentIds = new Set(current.map(e => e.id));
    const allSelected = elements.every(e => currentIds.has(e.id));

    if (allSelected) {
      // Deselect all in group
      const removeIds = new Set(elements.map(e => e.id));
      set({
        selectedElements: current.filter(e => !removeIds.has(e.id)),
      });
    } else {
      // Select any remaining in group
      const seenNew = new Set<string>();
      const toAdd: SelectedElement[] = [];
      for (const el of elements) {
        if (!currentIds.has(el.id) && !seenNew.has(el.id)) {
          seenNew.add(el.id);
          toAdd.push(el);
        }
      }
      set({
        selectedElements: [...current, ...toAdd],
      });
    }
  },

  clearSelection: () => {
    set({ selectedElements: [] });
  },

  isSelected: (id) => {
    return get().selectedElements.some(e => e.id === id);
  },

  isGroupSelected: (ids) => {
    if (ids.length === 0) return false;
    const currentIds = new Set(get().selectedElements.map(e => e.id));
    return ids.every(id => currentIds.has(id));
  },

  isGroupPartiallySelected: (ids) => {
    if (ids.length === 0) return false;
    const currentIds = new Set(get().selectedElements.map(e => e.id));
    const count = ids.filter(id => currentIds.has(id)).length;
    return count > 0 && count < ids.length;
  },
}));
