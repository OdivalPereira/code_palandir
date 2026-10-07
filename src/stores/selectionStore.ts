import { create } from 'zustand';
import type { SelectedElement } from '@/types/prompt';

function isValidElement(element: unknown): element is SelectedElement {
  if (!element || typeof element !== 'object' || Array.isArray(element)) {
    return false;
  }
  const el = element as Record<string, unknown>;
  return (
    typeof el.id === 'string' &&
    el.id.trim().length > 0 &&
    typeof el.label === 'string' &&
    typeof el.nodeType === 'string'
  );
}

function cloneElement(element: SelectedElement): SelectedElement {
  return {
    id: element.id,
    label: element.label,
    nodeType: element.nodeType,
    filePath: element.filePath,
    codeSnippet: element.codeSnippet,
    details: element.details && typeof element.details === 'object' && !Array.isArray(element.details)
      ? { ...element.details }
      : element.details,
  };
}

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
    if (!isValidElement(element)) return;
    const current = get().selectedElements;
    const exists = current.some((e) => e.id === element.id);
    if (exists) {
      set({
        selectedElements: current.filter((e) => e.id !== element.id),
      });
    } else {
      set({
        selectedElements: [...current, cloneElement(element)],
      });
    }
  },

  addElement: (element) => {
    if (!isValidElement(element)) return;
    const current = get().selectedElements;
    if (!current.some((e) => e.id === element.id)) {
      set({
        selectedElements: [...current, cloneElement(element)],
      });
    }
  },

  addElements: (elements) => {
    if (!Array.isArray(elements) || elements.length === 0) return;
    const current = get().selectedElements;
    const currentIds = new Set(current.map((e) => e.id));
    const seenNew = new Set<string>();
    const toAdd: SelectedElement[] = [];

    for (const el of elements) {
      if (!isValidElement(el)) continue;
      if (!currentIds.has(el.id) && !seenNew.has(el.id)) {
        seenNew.add(el.id);
        toAdd.push(cloneElement(el));
      }
    }

    if (toAdd.length > 0) {
      set({
        selectedElements: [...current, ...toAdd],
      });
    }
  },

  removeElement: (id) => {
    if (typeof id !== 'string' || !id.trim()) return;
    const current = get().selectedElements;
    if (!current.some((e) => e.id === id)) return;
    set({
      selectedElements: current.filter((e) => e.id !== id),
    });
  },

  removeElements: (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0));
    if (idSet.size === 0) return;
    const current = get().selectedElements;
    const filtered = current.filter((e) => !idSet.has(e.id));
    if (filtered.length !== current.length) {
      set({
        selectedElements: filtered,
      });
    }
  },

  toggleGroup: (elements) => {
    if (!Array.isArray(elements) || elements.length === 0) return;
    const validElements = elements.filter(isValidElement);
    if (validElements.length === 0) return;

    const current = get().selectedElements;
    const currentIds = new Set(current.map((e) => e.id));
    const allSelected = validElements.every((e) => currentIds.has(e.id));

    if (allSelected) {
      // Deselect all in group
      const removeIds = new Set(validElements.map((e) => e.id));
      set({
        selectedElements: current.filter((e) => !removeIds.has(e.id)),
      });
    } else {
      // Select any remaining in group
      const seenNew = new Set<string>();
      const toAdd: SelectedElement[] = [];
      for (const el of validElements) {
        if (!currentIds.has(el.id) && !seenNew.has(el.id)) {
          seenNew.add(el.id);
          toAdd.push(cloneElement(el));
        }
      }
      set({
        selectedElements: [...current, ...toAdd],
      });
    }
  },

  clearSelection: () => {
    if (get().selectedElements.length > 0) {
      set({ selectedElements: [] });
    }
  },

  isSelected: (id) => {
    if (typeof id !== 'string' || !id.trim()) return false;
    return get().selectedElements.some((e) => e.id === id);
  },

  isGroupSelected: (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const validIds = ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length === 0 || validIds.length !== ids.length) return false;
    const currentIds = new Set(get().selectedElements.map((e) => e.id));
    return validIds.every((id) => currentIds.has(id));
  },

  isGroupPartiallySelected: (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const validIds = ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length === 0) return false;
    const currentIds = new Set(get().selectedElements.map((e) => e.id));
    const count = validIds.filter((id) => currentIds.has(id)).length;
    return count > 0 && count < validIds.length;
  },
}));

