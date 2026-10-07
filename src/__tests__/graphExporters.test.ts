import { describe, it, expect } from 'vitest';
import { generateMermaidDiagram } from '@/services/mermaidGenerator';
import {
  exportToMermaid,
  generateArchitectureMarkdownReport,
} from '@/services/graphExporters';
import type { FlowUINode, FlowUIEdge } from '@/types/graph';
import type { ProjectAnalysis } from '@/types/analysis';

describe('Graph Exporters & Mermaid Generator (Elrond & Radagast)', () => {
  const sampleNodes: FlowUINode[] = [
    {
      id: 'node-route-home',
      type: 'route',
      position: { x: 0, y: 0 },
      data: {
        id: 'node-route-home',
        label: '/',
        nodeType: 'route',
      } as any,
    },
    {
      id: 'node-page-home',
      type: 'page',
      position: { x: 100, y: 0 },
      data: {
        id: 'node-page-home',
        label: 'HomePage',
        nodeType: 'page',
      } as any,
    },
    {
      id: 'node-comp-button',
      type: 'component',
      position: { x: 200, y: 0 },
      data: {
        id: 'node-comp-button',
        label: 'SubmitButton',
        nodeType: 'component',
      } as any,
    },
    {
      id: 'node-action-click',
      type: 'action',
      position: { x: 300, y: 0 },
      data: {
        id: 'node-action-click',
        label: 'onClick: handleSubmit',
        nodeType: 'action',
      } as any,
    },
    {
      id: 'node-store-auth',
      type: 'store',
      position: { x: 200, y: 100 },
      data: {
        id: 'node-store-auth',
        label: 'useAuthStore',
        nodeType: 'store',
      } as any,
    },
    {
      id: 'node-api-login',
      type: 'api',
      position: { x: 300, y: 100 },
      data: {
        id: 'node-api-login',
        label: 'POST /api/login',
        nodeType: 'api',
      } as any,
    },
  ];

  const sampleEdges: FlowUIEdge[] = [
    {
      id: 'e1',
      source: 'node-route-home',
      target: 'node-page-home',
      data: { relation: 'routes_to', label: 'renders' },
    },
    {
      id: 'e2',
      source: 'node-page-home',
      target: 'node-comp-button',
      data: { relation: 'renders', label: 'renders' },
    },
    {
      id: 'e3',
      source: 'node-comp-button',
      target: 'node-action-click',
      data: { relation: 'triggers' },
    },
    {
      id: 'e4',
      source: 'node-page-home',
      target: 'node-store-auth',
      data: { relation: 'accesses_store' },
    },
    {
      id: 'e5',
      source: 'node-comp-button',
      target: 'node-api-login',
      data: { relation: 'calls_api' },
    },
  ];

  it('generates valid flowchart syntax for empty graphs', () => {
    const mermaid = generateMermaidDiagram([], []);
    expect(mermaid).toContain('flowchart LR');
    expect(mermaid).toContain('(Grafo Vazio)');

    const exported = exportToMermaid([], []);
    expect(exported).toBe(mermaid);
  });

  it('formats distinct node types with their appropriate shapes and classDef styles', () => {
    const mermaid = generateMermaidDiagram(sampleNodes, sampleEdges, {
      direction: 'TD',
      includeStyles: true,
    });

    expect(mermaid.startsWith('flowchart TD')).toBe(true);

    // Verificação de classes e formatos
    expect(mermaid).toContain('node_route_home["🌐 /"]:::routeStyle');
    expect(mermaid).toContain('node_page_home[["📄 HomePage"]]:::pageStyle');
    expect(mermaid).toContain('node_comp_button["📦 SubmitButton"]:::compStyle');
    expect(mermaid).toContain('node_action_click("{⚡ onClick: handleSubmit}"):::actionStyle');
    expect(mermaid).toContain('node_store_auth[("💾 useAuthStore")]:::storeStyle');
    expect(mermaid).toContain('node_api_login>"☁️ POST /api/login"]:::apiStyle');

    // Verificação de arestas
    expect(mermaid).toContain('node_route_home ==>|renderiza| node_page_home');
    expect(mermaid).toContain('node_page_home -->|renders| node_comp_button');
    expect(mermaid).toContain('node_comp_button ==>|chama| node_api_login');

    // Verificação de declaração de estilos
    expect(mermaid).toContain('classDef routeStyle fill:#1e3a8a');
    expect(mermaid).toContain('classDef pageStyle fill:#064e3b');
    expect(mermaid).toContain('classDef compStyle fill:#4c1d95');
  });

  it('filters dimmed nodes and edges when filterDimmed is enabled', () => {
    const nodesWithDimmed = sampleNodes.map((n, idx) => ({
      ...n,
      data: { ...n.data, isDimmed: idx >= 3 },
    }));

    const mermaid = generateMermaidDiagram(nodesWithDimmed, sampleEdges, {
      filterDimmed: true,
    });

    // Nós não esmaecidos devem estar presentes
    expect(mermaid).toContain('node_route_home');
    expect(mermaid).toContain('node_page_home');
    expect(mermaid).toContain('node_comp_button');

    // Nós esmaecidos não devem constar
    expect(mermaid).not.toContain('node_action_click');
    expect(mermaid).not.toContain('node_store_auth');
    expect(mermaid).not.toContain('node_api_login');
  });

  it('generates a comprehensive Architecture Markdown Report with embedded Mermaid diagram', () => {
    const mockAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [
        {
          id: 'r1',
          path: '/',
          pageComponentName: 'HomePage',
          filePath: 'src/pages/HomePage.tsx',
        },
      ],
      pages: [
        {
          id: 'p1',
          name: 'HomePage',
          filePath: 'src/pages/HomePage.tsx',
          isPage: true,
          isExported: true,
          childrenNames: ['SubmitButton'],
          actions: [],
          hooks: [],
          stores: [
            {
              id: 's1',
              storeName: 'useAuthStore',
              type: 'zustand',
              properties: ['user'],
            },
          ],
          apiCalls: [],
          props: [],
          wireframe: [],
          codeSnippet: '',
        },
      ],
      components: [
        {
          id: 'c1',
          name: 'SubmitButton',
          filePath: 'src/components/SubmitButton.tsx',
          isPage: false,
          isExported: true,
          childrenNames: [],
          actions: [],
          hooks: [],
          stores: [],
          apiCalls: [],
          props: [],
          wireframe: [],
          codeSnippet: '',
        },
      ],
      actions: [],
      hooks: [],
      stores: [{ id: 's1', storeName: 'useAuthStore', type: 'zustand', properties: ['user'] }],
      apiCalls: [],
      analysisDurationMs: 42,
    };

    const report = generateArchitectureMarkdownReport(
      mockAnalysis,
      sampleNodes,
      sampleEdges,
      'Code Palandir Demo'
    );

    expect(report).toContain('# Raio-X Arquitetural — Code Palandir Demo');
    expect(report).toContain('**Score de Saúde Arquitetural**');
    expect(report).toContain('Catálogo de Rotas e Telas Mapeadas');
    expect(report).toContain('<HomePage />');
    expect(report).toContain('Stores ativas: `useAuthStore`');
    expect(report).toContain('```mermaid');
    expect(report).toContain('flowchart LR');
    expect(report).toContain('node_route_home');
  });
});
