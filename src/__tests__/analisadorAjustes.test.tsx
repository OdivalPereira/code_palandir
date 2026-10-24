import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DetailSidebar } from '../features/detail/DetailSidebar';
import { useGraphStore } from '../stores/graphStore';
import type { FlowUINode } from '../types/graph';
import { analyzeProject } from '../engine/analyzers';
import { buildGraphFromAnalysis } from '../engine/graphBuilder';
import { detectRoutes } from '../engine/analyzers/routeDetector';
import { looksLikeStoreHook } from '../engine/parser/babelParser';
import { createDemoProjectFiles } from '../services/demoProject';

const noPagina = {
  id: 'node-page-login',
  type: 'page',
  position: { x: 0, y: 0 },
  data: {
    id: 'node-page-login',
    label: 'LoginPage',
    nodeType: 'page',
    filePath: 'src/pages/LoginPage.tsx',
    codeSnippet: 'export function LoginPage() { return <form />; }',
  },
} as unknown as FlowUINode;

describe('DetailSidebar', () => {
  beforeEach(() => {
    act(() => useGraphStore.setState({ selectedNode: null }));
  });

  it('troca entre vazio e um nó sem quebrar a ordem dos hooks', () => {
    render(<DetailSidebar />);
    expect(screen.getByText('Nenhum elemento selecionado')).toBeTruthy();

    act(() => useGraphStore.setState({ selectedNode: noPagina }));
    expect(screen.getByRole('heading', { name: 'LoginPage' })).toBeTruthy();

    act(() => useGraphStore.setState({ selectedNode: null }));
    expect(screen.getByText('Nenhum elemento selecionado')).toBeTruthy();
  });
});

describe('Grafo do projeto demo', () => {
  const analise = analyzeProject(createDemoProjectFiles());
  const grafo = buildGraphFromAnalysis(analise);
  const rotulo = (id: string) => grafo.nodes.find((n) => n.id === id)?.data.label;
  const arestas = grafo.edges.map((e) => `${rotulo(e.source)} -${e.data?.relation}-> ${rotulo(e.target)}`);

  it('liga cada rota à página, mesmo com a rota criada antes da página', () => {
    for (const [rota, pagina] of [
      ['/login', 'LoginPage'],
      ['/dashboard', 'DashboardPage'],
      ['/reports', 'ReportsPage'],
      ['/settings', 'SettingsPage'],
    ]) {
      expect(arestas).toContain(`${rota} -routes_to-> ${pagina}`);
    }
  });

  it('liga pai a filho mesmo quando o filho é descoberto depois', () => {
    expect(arestas).toContain('LoginPage -renders-> LoginForm');
    expect(arestas).toContain('DashboardPage -renders-> MetricsCard');
    expect(arestas).toContain('DashboardPage -renders-> UserTable');
  });

  it('não inventa rotas de Pages Router num app React com pasta src/pages', () => {
    expect(analise.framework).toBe('react');
    expect(analise.routes.map((r) => r.path).sort()).toEqual(['/dashboard', '/login', '/reports', '/settings']);
  });

  it('useState não vira store, e o mesmo store conta uma vez por componente', () => {
    const porComponente = [...analise.pages, ...analise.components].map((c) => [
      c.name,
      c.stores.map((st) => st.storeName),
    ]);
    for (const [, stores] of porComponente) {
      expect(stores).not.toContain('useState');
      expect(new Set(stores as string[]).size).toBe((stores as string[]).length);
    }
    expect(analise.stores.map((st) => st.storeName)).toContain('useAuthStore');
  });
});

describe('looksLikeStoreHook', () => {
  it.each(['useAuthStore', 'useStore', 'useAppState', 'useCartStore'])('%s é store', (nome) => {
    expect(looksLikeStoreHook(nome)).toBe(true);
  });
  it.each(['useState', 'useSyncExternalStore', 'useFormState', 'useActionState', 'useEffect', 'useAuth'])(
    '%s não é store',
    (nome) => {
      expect(looksLikeStoreHook(nome)).toBe(false);
    }
  );
});

describe('detectRoutes com framework conhecido', () => {
  const arquivos = [{ path: 'src/pages/about.tsx', content: 'export default function About() { return <div/>; }', language: 'tsx' }];
  it('Next.js usa a convenção de pasta pages/', () => {
    expect(detectRoutes(arquivos as never, [], 'nextjs').map((r) => r.path)).toContain('/about');
  });
  it('React SPA não usa', () => {
    expect(detectRoutes(arquivos as never, [], 'react').map((r) => r.path)).not.toContain('/about');
  });
});
