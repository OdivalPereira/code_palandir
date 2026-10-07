import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '@/stores/graphStore';
import { useSelectionStore } from '@/stores/selectionStore';
import type { SerializedGraphBundle } from '@/types/graph';

describe('GraphStore Persistence & Schema Validation', () => {
  beforeEach(() => {
    useGraphStore.getState().reset();
    useSelectionStore.getState().clearSelection();
  });

  describe('exportGraphBundle', () => {
    it('generates a valid SerializedGraphBundle conforming to 1.0.0 schema', () => {
      const bundle = useGraphStore.getState().exportGraphBundle();
      expect(bundle.version).toBe('1.0.0');
      expect(typeof bundle.exportedAt).toBe('string');
      expect(bundle.layoutDirection).toBe('LR');
      expect(bundle.expansionLevel).toBe(1);
      expect(Array.isArray(bundle.nodes)).toBe(true);
      expect(Array.isArray(bundle.edges)).toBe(true);
      expect(bundle.filters).toBeDefined();
    });

    it('returns an immutable deep clone of state', () => {
      const bundle = useGraphStore.getState().exportGraphBundle();
      expect(bundle.nodes).not.toBe(useGraphStore.getState().nodes);
      expect(bundle.edges).not.toBe(useGraphStore.getState().edges);
      expect(bundle.filters).not.toBe(useGraphStore.getState().filters);
    });
  });

  describe('importGraphBundle defensive validation', () => {
    const validBundle: SerializedGraphBundle = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      meta: {
        projectName: 'TestApp',
        framework: 'react',
      },
      filters: {
        searchQuery: 'dashboard',
        showRoutes: true,
        showPages: true,
        showComponents: true,
        showActions: true,
        showHooks: false,
        showStores: true,
        showApis: true,
      },
      layoutDirection: 'TB',
      expansionLevel: 2,
      nodes: [
        {
          id: 'node-page-1',
          position: { x: 50, y: 100 },
          data: { id: 'node-page-1', label: 'DashboardPage', nodeType: 'page' },
        } as any,
        {
          id: 'node-comp-2',
          position: { x: 200, y: 300 },
          data: { id: 'node-comp-2', label: 'StatsWidget', nodeType: 'component' },
        } as any,
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-page-1',
          target: 'node-comp-2',
          data: { relation: 'renders' },
        } as any,
      ],
    };

    it('successfully imports valid bundle and updates graphStore state', () => {
      const res = useGraphStore.getState().importGraphBundle(validBundle);
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();

      const state = useGraphStore.getState();
      expect(state.layoutDirection).toBe('TB');
      expect(state.expansionLevel).toBe(2);
      expect(state.nodes.length).toBe(2);
      expect(state.edges.length).toBe(1);
      expect(state.filters.searchQuery).toBe('dashboard');
    });

    it('successfully imports valid bundle from JSON string', () => {
      const res = useGraphStore.getState().importGraphBundle(JSON.stringify(validBundle));
      expect(res.success).toBe(true);
      expect(useGraphStore.getState().nodes.length).toBe(2);
    });

    it('defensively rejects invalid version', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        version: '2.0.0',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Versão de bundle incompatível');
    });

    it('defensively rejects missing or empty exportedAt', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        exportedAt: '',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('exportedAt');
    });

    it('defensively rejects invalid layoutDirection', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        layoutDirection: 'DIAGONAL',
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('layoutDirection');
    });

    it('defensively rejects invalid expansionLevel', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        expansionLevel: 5,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('expansionLevel');
    });

    it('defensively rejects duplicate node IDs', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        nodes: [
          { id: 'dup', position: { x: 0, y: 0 }, data: { id: 'dup', label: 'A' } },
          { id: 'dup', position: { x: 10, y: 10 }, data: { id: 'dup', label: 'B' } },
        ],
        edges: [],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('duplicado');
    });

    it('defensively rejects duplicate edge IDs', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        edges: [
          { id: 'dup-edge', source: 'node-page-1', target: 'node-comp-2' },
          { id: 'dup-edge', source: 'node-comp-2', target: 'node-page-1' },
        ],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('duplicado');
    });

    it('defensively enforces referential ID integrity: invalid source', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        edges: [
          { id: 'e-bad-src', source: 'ghost-source', target: 'node-comp-2' },
        ],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Integridade referencial violada');
      expect(res.error).toContain('ghost-source');
    });

    it('defensively enforces referential ID integrity: invalid target', () => {
      const res = useGraphStore.getState().importGraphBundle({
        ...validBundle,
        edges: [
          { id: 'e-bad-tgt', source: 'node-page-1', target: 'ghost-target' },
        ],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Integridade referencial violada');
      expect(res.error).toContain('ghost-target');
    });
  });

  describe('selectionStore defensive hardening', () => {
    it('safely ignores invalid inputs and guards type integrity', () => {
      useSelectionStore.getState().addElement(null as any);
      useSelectionStore.getState().addElement({} as any);
      useSelectionStore.getState().addElements([null as any, undefined as any]);
      expect(useSelectionStore.getState().selectedElements).toHaveLength(0);
    });

    it('ensures object immutability when caller mutates element after addition', () => {
      const el: any = {
        id: 'sel-1',
        label: 'ImmutableCheck',
        nodeType: 'component',
        details: { deep: 'value' },
      };
      useSelectionStore.getState().addElement(el);
      el.label = 'Hacked';
      el.details.deep = 'Mutated';

      const stored = useSelectionStore.getState().selectedElements[0];
      expect(stored.label).toBe('ImmutableCheck');
      expect(stored.details?.deep).toBe('value');
    });

    it('safely handles non-string or malformed IDs in removal methods', () => {
      useSelectionStore.getState().addElement({ id: 'valid-1', label: 'V', nodeType: 'page' });
      useSelectionStore.getState().removeElement(null as any);
      useSelectionStore.getState().removeElements(['', null as any, undefined as any]);
      expect(useSelectionStore.getState().selectedElements).toHaveLength(1);
    });
  });
});
