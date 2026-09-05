import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '@/stores/selectionStore';
import type { SelectedElement } from '@/types/prompt';

describe('selectionStore group operations', () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  const el1: SelectedElement = {
    id: 'el-1',
    label: 'DashboardPage',
    nodeType: 'page',
    filePath: 'src/pages/DashboardPage.tsx',
  };
  const el2: SelectedElement = {
    id: 'el-2',
    label: 'MetricsCard',
    nodeType: 'component',
    filePath: 'src/components/MetricsCard.tsx',
  };
  const el3: SelectedElement = {
    id: 'el-3',
    label: 'onClick: handleRefresh',
    nodeType: 'action',
    filePath: 'src/components/MetricsCard.tsx',
  };

  it('adds multiple elements without duplicates', () => {
    useSelectionStore.getState().addElements([el1, el2]);
    expect(useSelectionStore.getState().selectedElements).toHaveLength(2);

    // Adding duplicate el1 and new el3
    useSelectionStore.getState().addElements([el1, el3]);
    expect(useSelectionStore.getState().selectedElements).toHaveLength(3);
    expect(useSelectionStore.getState().isGroupSelected(['el-1', 'el-2', 'el-3'])).toBe(true);
  });

  it('removes multiple elements by ids', () => {
    useSelectionStore.getState().addElements([el1, el2, el3]);
    useSelectionStore.getState().removeElements(['el-1', 'el-3']);

    const remaining = useSelectionStore.getState().selectedElements;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('el-2');
  });

  it('toggles a whole group: selects all when partially selected, deselects all when fully selected', () => {
    const group = [el1, el2, el3];

    // Case 1: none selected -> selects all
    useSelectionStore.getState().toggleGroup(group);
    expect(useSelectionStore.getState().isGroupSelected(['el-1', 'el-2', 'el-3'])).toBe(true);
    expect(useSelectionStore.getState().selectedElements).toHaveLength(3);

    // Case 2: all selected -> deselects all
    useSelectionStore.getState().toggleGroup(group);
    expect(useSelectionStore.getState().selectedElements).toHaveLength(0);

    // Case 3: partially selected (only el1 selected) -> selects remaining
    useSelectionStore.getState().addElement(el1);
    expect(useSelectionStore.getState().isGroupSelected(['el-1', 'el-2', 'el-3'])).toBe(false);

    useSelectionStore.getState().toggleGroup(group);
    expect(useSelectionStore.getState().isGroupSelected(['el-1', 'el-2', 'el-3'])).toBe(true);
    expect(useSelectionStore.getState().selectedElements).toHaveLength(3);
  });

  it('accurately identifies partial group selection', () => {
    const ids = ['el-1', 'el-2', 'el-3'];

    // Empty list
    expect(useSelectionStore.getState().isGroupPartiallySelected([])).toBe(false);

    // None selected
    expect(useSelectionStore.getState().isGroupPartiallySelected(ids)).toBe(false);

    // 1 of 3 selected -> partial
    useSelectionStore.getState().addElement(el1);
    expect(useSelectionStore.getState().isGroupPartiallySelected(ids)).toBe(true);

    // 2 of 3 selected -> partial
    useSelectionStore.getState().addElement(el2);
    expect(useSelectionStore.getState().isGroupPartiallySelected(ids)).toBe(true);

    // 3 of 3 selected -> fully selected, not partial
    useSelectionStore.getState().addElement(el3);
    expect(useSelectionStore.getState().isGroupPartiallySelected(ids)).toBe(false);
    expect(useSelectionStore.getState().isGroupSelected(ids)).toBe(true);
  });
});
