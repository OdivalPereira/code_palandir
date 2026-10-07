import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ForensicsPanel } from '@/features/detail/ForensicsPanel';
import { useGraphStore } from '@/stores/graphStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import type { FlowUINode, FlowUIEdge } from '@/types/graph';
import type { ProjectAnalysis } from '@/types/analysis';

// Mock clipboard
vi.mock('@/services/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

describe('ForensicsPanel UI & Accessibility (Legolas)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNode: null,
    });
    useProjectStore.setState({
      meta: null,
      analysis: null,
    });
    useUIStore.setState({
      activeSidebarTab: 'forensics',
      sidebarOpen: true,
    });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('renders clean baseline when no anomalies exist', async () => {
    await act(async () => {
      root.render(<ForensicsPanel />);
    });

    expect(container.textContent).toContain('Auditoria Forense & Saúde');
    expect(container.textContent).toContain('100 / 100');
    expect(container.textContent).toContain('Nenhuma anomalia topológica detectada');
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('displays detected cycles and provides Focus action', async () => {
    // Setup a directed cycle: NodeA -> NodeB -> NodeA
    const nodes: FlowUINode[] = [
      {
        id: 'node-comp-a',
        type: 'component',
        position: { x: 0, y: 0 },
        data: { id: 'node-comp-a', label: 'ComponentA', nodeType: 'component' } as any,
      },
      {
        id: 'node-comp-b',
        type: 'component',
        position: { x: 100, y: 0 },
        data: { id: 'node-comp-b', label: 'ComponentB', nodeType: 'component' } as any,
      },
    ];

    const edges: FlowUIEdge[] = [
      { id: 'e1', source: 'node-comp-a', target: 'node-comp-b', data: { relation: 'renders' } },
      { id: 'e2', source: 'node-comp-b', target: 'node-comp-a', data: { relation: 'renders' } },
    ];

    useGraphStore.setState({ nodes, edges });

    await act(async () => {
      root.render(<ForensicsPanel />);
    });

    expect(container.textContent).toContain('DIRECTED_CYCLE');
    expect(container.textContent).toContain('Ciclo direcionado detectado');

    const focusBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Focar')
    );
    expect(focusBtn).toBeDefined();

    await act(async () => {
      focusBtn?.click();
    });

    const selected = useGraphStore.getState().selectedNode;
    expect(selected).not.toBeNull();
    expect(selected?.id).toBe('node-comp-a');
  });

  it('displays coupling metrics and God Component warnings', async () => {
    const mockAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [
        {
          id: 'c-god',
          name: 'HypertrophiedGod',
          filePath: 'HypertrophiedGod.tsx',
          isPage: false,
          isExported: true,
          childrenNames: ['SubA', 'SubB', 'SubC', 'SubD', 'SubE', 'SubF', 'SubG', 'SubH', 'SubI'],
          actions: [
            { id: 'a1', name: 'act1', trigger: 'onClick', componentName: 'HypertrophiedGod', filePath: '', codeSnippet: '', apiCalls: [], stateUpdates: [] },
            { id: 'a2', name: 'act2', trigger: 'onClick', componentName: 'HypertrophiedGod', filePath: '', codeSnippet: '', apiCalls: [], stateUpdates: [] },
          ],
          hooks: [],
          stores: [
            { id: 's1', storeName: 'useStoreA', type: 'zustand', properties: [] },
            { id: 's2', storeName: 'useStoreB', type: 'zustand', properties: [] },
          ],
          apiCalls: [
            { id: 'api-1', endpoint: '/api/leak', method: 'POST', client: 'fetch', callerComponent: 'HypertrophiedGod', filePath: '' },
          ],
          props: [],
          wireframe: [],
          codeSnippet: '',
        },
      ],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 15,
    };

    useProjectStore.setState({ analysis: mockAnalysis });

    await act(async () => {
      root.render(<ForensicsPanel />);
    });

    expect(container.textContent).toContain('Gargalos de Acoplamento');
    expect(container.textContent).toContain('HypertrophiedGod');
    expect(container.textContent).toContain('Instabilidade:');
  });

  it('triggers clipboard copies on Mermaid and Report button clicks', async () => {
    const { copyToClipboard } = await import('@/services/clipboard');

    const mockAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 5,
    };

    useProjectStore.setState({ analysis: mockAnalysis });

    await act(async () => {
      root.render(<ForensicsPanel />);
    });

    const mermaidBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Mermaid')
    );
    expect(mermaidBtn).toBeDefined();

    await act(async () => {
      mermaidBtn?.click();
    });
    expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('flowchart'));

    const reportBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Relatório MD')
    );
    expect(reportBtn).toBeDefined();

    await act(async () => {
      reportBtn?.click();
    });
    expect(copyToClipboard).toHaveBeenCalledWith(expect.stringContaining('# Raio-X Arquitetural'));
  });
});
