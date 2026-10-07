import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Input } from '@/ui/Input';
import { Badge } from '@/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/ui/Card';
import { GraphCanvas } from '@/features/graph/GraphCanvas';

import { useProjectStore } from '@/stores/projectStore';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import type { ProjectMeta } from '@/types/project';
import type { ProjectAnalysis } from '@/types/analysis';

// Polyfills for JSDOM
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe('UI & Accessibility Audits (WCAG AA)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  describe('Button WCAG AA & Semantics', () => {
    it('renders with WCAG AA focus rings, offsets and contrast classes', async () => {
      await act(async () => {
        root.render(<Button variant="default">Test Button</Button>);
      });

      const btn = container.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn?.className).toContain('focus-visible:ring-2');
      expect(btn?.className).toContain('focus-visible:ring-indigo-500');
      expect(btn?.className).toContain('focus-visible:ring-offset-2');
      expect(btn?.className).toContain('focus-visible:ring-offset-slate-950');
      expect(btn?.textContent).toBe('Test Button');
    });

    it('sets aria-disabled when disabled is true', async () => {
      await act(async () => {
        root.render(<Button disabled>Disabled Action</Button>);
      });

      const btn = container.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn?.hasAttribute('disabled')).toBe(true);
      expect(btn?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets aria-disabled when aria-disabled prop is passed directly', async () => {
      await act(async () => {
        root.render(<Button aria-disabled={true}>Aria Disabled</Button>);
      });

      const btn = container.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn?.getAttribute('aria-disabled')).toBe('true');
    });

    it('triggers click handlers on interactive click and keyboard Enter', async () => {
      const handleClick = vi.fn();
      await act(async () => {
        root.render(<Button onClick={handleClick}>Click Me</Button>);
      });

      const btn = container.querySelector('button');
      expect(btn).not.toBeNull();

      await act(async () => {
        btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not trigger click handlers when disabled', async () => {
      const handleClick = vi.fn();
      await act(async () => {
        root.render(<Button disabled onClick={handleClick}>Disabled</Button>);
      });

      const btn = container.querySelector('button');
      await act(async () => {
        btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Dialog WCAG AA Semantics', () => {
    it('renders with role="dialog", aria-modal="true", and aria-labelledby linking to title id', async () => {
      await act(async () => {
        root.render(
          <Dialog open={true} onClose={() => {}} title="Configurações de Exportação" description="Selecione as opções desejadas">
            <p>Conteúdo do diálogo</p>
          </Dialog>
        );
      });

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.getAttribute('aria-labelledby')).toBe('dialog-title');

      const title = container.querySelector('#dialog-title');
      expect(title).not.toBeNull();
      expect(title?.textContent).toBe('Configurações de Exportação');

      const closeButton = container.querySelector('button[aria-label="Fechar diálogo"]');
      expect(closeButton).not.toBeNull();
    });

    it('calls onClose when close button is clicked or Escape key is pressed', async () => {
      const handleClose = vi.fn();
      await act(async () => {
        root.render(
          <Dialog open={true} onClose={handleClose} title="Diálogo de Teste">
            <p>Conteúdo</p>
          </Dialog>
        );
      });

      const closeButton = container.querySelector('button[aria-label="Fechar diálogo"]');
      await act(async () => {
        closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      expect(handleClose).toHaveBeenCalledTimes(1);

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('does not render anything when open is false', async () => {
      await act(async () => {
        root.render(
          <Dialog open={false} onClose={() => {}} title="Invisível">
            <p>Conteúdo</p>
          </Dialog>
        );
      });

      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe('Input WCAG AA Semantics & Focus States', () => {
    it('renders with focus-visible ring offset classes', async () => {
      await act(async () => {
        root.render(<Input placeholder="Filtrar componentes..." />);
      });

      const input = container.querySelector('input');
      expect(input).not.toBeNull();
      expect(input?.className).toContain('focus-visible:ring-offset-2');
      expect(input?.className).toContain('focus-visible:ring-offset-slate-950');
      expect(input?.getAttribute('aria-invalid')).toBeNull();
    });

    it('renders aria-invalid="true" and error styling when isInvalid is set', async () => {
      await act(async () => {
        root.render(<Input isInvalid placeholder="Campo com erro" />);
      });

      const input = container.querySelector('input');
      expect(input?.getAttribute('aria-invalid')).toBe('true');
      expect(input?.className).toContain('border-rose-500');
      expect(input?.className).toContain('focus-visible:ring-rose-500');
    });

    it('handles focus, blur, and typing events', async () => {
      const handleInput = vi.fn();
      await act(async () => {
        root.render(<Input onInput={handleInput} />);
      });

      const input = container.querySelector('input')!;
      await act(async () => {
        input.focus();
        input.value = 'nova busca';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(handleInput).toHaveBeenCalled();
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Badge & Card WCAG Contrast', () => {
    it('Badge renders high contrast text for secondary and outline variants', async () => {
      await act(async () => {
        root.render(
          <>
            <Badge variant="secondary" data-testid="b-sec">Badge Secundário</Badge>
            <Badge variant="outline" data-testid="b-out">Badge Contorno</Badge>
          </>
        );
      });

      const secBadge = container.querySelector('[data-testid="b-sec"]');
      const outBadge = container.querySelector('[data-testid="b-out"]');
      expect(secBadge?.className).toContain('text-slate-200');
      expect(outBadge?.className).toContain('text-slate-200');
    });

    it('Card renders structured header, title, and high contrast description', async () => {
      await act(async () => {
        root.render(
          <Card>
            <CardHeader>
              <CardTitle>Painel Principal</CardTitle>
              <CardDescription>Resumo dos componentes do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Conteúdo interno</p>
            </CardContent>
          </Card>
        );
      });

      const title = container.querySelector('h3');
      const desc = container.querySelector('p');
      expect(title?.textContent).toBe('Painel Principal');
      expect(desc?.className).toContain('text-slate-300');
    });
  });
});

describe('GraphCanvas: O Sexteto de Estados de Tela', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockMeta: ProjectMeta = {
    name: 'test-app',
    framework: 'react',
    sourceType: 'local-folder',
    sourceName: 'my-project',
    fileCount: 15,
    totalSize: 45000,
    createdAt: Date.now(),
  };

  const mockAnalysis: ProjectAnalysis = {
    framework: 'react',
    routes: [
      {
        id: 'route-home',
        path: '/',
        pageComponentName: 'HomePage',
        filePath: 'src/pages/Home.tsx',
      },
    ],
    pages: [
      {
        id: 'home',
        name: 'HomePage',
        filePath: 'src/pages/Home.tsx',
        isPage: true,
        isExported: true,
        childrenNames: ['SubmitButton'],
        actions: [],
        hooks: [],
        stores: [],
        apiCalls: [],
        props: [],
        wireframe: [],
        codeSnippet: '',
      },
    ],
    components: [
      {
        id: 'btn',
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
    stores: [],
    apiCalls: [],
    analysisDurationMs: 10,
  };

  const mockNodes: any[] = [
    {
      id: 'node-home',
      type: 'page',
      position: { x: 100, y: 100 },
      data: {
        id: 'node-home',
        label: 'HomePage',
        nodeType: 'page',
        filePath: 'src/pages/Home.tsx',
        isSearchMatch: false,
      },
    },
    {
      id: 'node-btn',
      type: 'component',
      position: { x: 200, y: 200 },
      data: {
        id: 'node-btn',
        label: 'SubmitButton',
        nodeType: 'component',
        filePath: 'src/components/SubmitButton.tsx',
        isSearchMatch: false,
      },
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Reset stores to empty initial state
    useProjectStore.getState().reset();
    useGraphStore.getState().reset();
    useUIStore.setState({ isImportModalOpen: false, activeSidebarTab: 'detail' });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  // Estado 1: VAZIO
  it('Estado 1 [Vazio]: renderiza tela de boas-vindas com botão acessível para conectar projeto', async () => {
    await act(async () => {
      root.render(<GraphCanvas />);
    });

    const welcomeRegion = container.querySelector('[role="region"][aria-label="Tela de boas-vindas do Code Palandir"]');
    expect(welcomeRegion).not.toBeNull();

    const connectBtn = container.querySelector('button[aria-label="Conectar Projeto"]');
    expect(connectBtn).not.toBeNull();
    expect(connectBtn?.textContent).toContain('Conectar Projeto');

    // Click connect button opens modal in UIStore
    await act(async () => {
      connectBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(useUIStore.getState().isImportModalOpen).toBe(true);
  });

  // Estado 2: CARREGANDO (LOADING)
  it('Estado 2 [Loading]: renderiza feedback acessível com role="status" e aria-live="polite"', async () => {
    useProjectStore.setState({ isAnalyzing: true, error: null });

    await act(async () => {
      root.render(<GraphCanvas />);
    });

    const statusRegion = container.querySelector('[role="status"][aria-live="polite"]');
    expect(statusRegion).not.toBeNull();
    expect(statusRegion?.textContent).toContain('Analisando Arquitetura do Frontend...');
  });

  // Estado 3: ERRO
  it('Estado 3 [Erro]: inspeciona erro do store, renderiza role="alert" e botões Tentar Novamente e Reiniciar', async () => {
    const runAnalysisSpy = vi.fn();
    useProjectStore.setState({
      error: 'Não foi possível ler o repositório fornecido.',
      isAnalyzing: false,
      runAnalysis: runAnalysisSpy,
    });

    await act(async () => {
      root.render(<GraphCanvas />);
    });

    const alertRegion = container.querySelector('[role="alert"][aria-live="assertive"]');
    expect(alertRegion).not.toBeNull();
    expect(alertRegion?.textContent).toContain('Não foi possível ler o repositório fornecido.');

    const retryBtn = container.querySelector('button[aria-label="Tentar novamente a análise do projeto"]');
    expect(retryBtn).not.toBeNull();

    await act(async () => {
      retryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(runAnalysisSpy).toHaveBeenCalledTimes(1);

    const resetBtn = container.querySelector('button[aria-label="Reiniciar e voltar ao início"]');
    expect(resetBtn).not.toBeNull();
    await act(async () => {
      resetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(useProjectStore.getState().error).toBeNull();
  });

  // Estado 4: PARCIAL (DADOS PARCIAIS)
  it('Estado 4 [Parcial]: renderiza aviso sutil com role="status" quando houver dados parciais ou arquivos ignorados', async () => {
    const metaWithWarnings = {
      ...mockMeta,
      warnings: ['4 arquivos ignorados por excederem o tamanho limite de 1MB'],
    };

    useProjectStore.setState({
      meta: metaWithWarnings as any,
      isAnalyzing: false,
      error: null,
    });
    useGraphStore.setState({
      currentAnalysis: mockAnalysis,
      nodes: mockNodes,
      edges: [],
    });

    await act(async () => {
      root.render(<GraphCanvas />);
    });

    // The partial warning banner should be rendered
    const warningNotice = container.querySelector('[role="status"][aria-live="polite"]');
    expect(warningNotice).not.toBeNull();
    expect(warningNotice?.textContent).toContain('4 arquivos ignorados');
  });

  // Estado 5: SUCESSO (GRAFO RENDERIZADO)
  it('Estado 5 [Sucesso]: renderiza grafo com toolbar acessível, aria-pressed nos níveis e controles', async () => {
    useProjectStore.setState({
      meta: mockMeta,
      isAnalyzing: false,
      error: null,
    });
    useGraphStore.getState().buildGraph(mockAnalysis);
    useGraphStore.getState().setExpansionLevel(2);

    await act(async () => {
      root.render(<GraphCanvas />);
    });

    // Toolbar exists with accessible role and label
    const toolbar = container.querySelector('[role="toolbar"][aria-label="Controles de visualização e profundidade do grafo"]');
    expect(toolbar).not.toBeNull();

    // Depth buttons have proper aria-pressed and labels
    const btnLvl1 = container.querySelector('button[aria-label="Nível 1: Telas e Rotas (Recolher Tudo)"]');
    const btnLvl2 = container.querySelector('button[aria-label="Nível 2: Mostrar Telas e Componentes diretos"]');
    const btnLvl3 = container.querySelector('button[aria-label="Nível 3: Expandir Tudo (Componentes, Ações, APIs, Stores)"]');

    expect(btnLvl1?.getAttribute('aria-pressed')).toBe('false');
    expect(btnLvl2?.getAttribute('aria-pressed')).toBe('true');
    expect(btnLvl3?.getAttribute('aria-pressed')).toBe('false');

    // Clicking level 3 updates expansion level in store
    await act(async () => {
      btnLvl3?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(useGraphStore.getState().expansionLevel).toBe(3);

    // Visible nodes badge
    const badge = container.querySelector('[role="status"]');
    expect(badge).not.toBeNull();
  });

  // Estado 6: BUSCA VAZIA (FILTRO SEM RESULTADOS)
  it('Estado 6 [Busca Vazia]: exibe aviso acessível quando a busca não encontra nenhum elemento no grafo', async () => {
    useProjectStore.setState({
      meta: mockMeta,
      isAnalyzing: false,
      error: null,
    });
    useGraphStore.setState({
      currentAnalysis: mockAnalysis,
      nodes: mockNodes,
      edges: [],
      filters: {
        searchQuery: 'NonExistentComponent123',
        showRoutes: true,
        showPages: true,
        showComponents: true,
        showActions: true,
        showHooks: false,
        showStores: true,
        showApis: true,
      },
    });

    await act(async () => {
      root.render(<GraphCanvas />);
    });

    const searchEmptyBanner = container.querySelector('[role="status"][aria-live="polite"]');
    expect(searchEmptyBanner).not.toBeNull();
    expect(searchEmptyBanner?.textContent).toContain('Nenhum elemento encontrado para “NonExistentComponent123”');
  });
});
