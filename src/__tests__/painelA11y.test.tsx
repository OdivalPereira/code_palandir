import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as fs from 'fs';
import * as path from 'path';
import { PainelShell } from '../app/PainelShell';
import { MarcoJornada, SeloEstado, TipoEstadoRPG } from '../app/rpgTheme';
import { HojePage } from '../painel/hoje/HojePage';
import { PergaminhoAbertura } from '../painel/mensagem/PergaminhoAbertura';
import { ProjetosPage } from '../painel/projetos/ProjetosPage';
import { usePainelStore } from '../stores/painelStore';
import { cenarioVazio, exemploOficial } from '../painel/fixtures/cenarios';

/* =========================================================================
   ORÁCULO INDEPENDENTE DE LUMINÂNCIA RELATIVA E CONTRASTE WCAG 2.1
   Fórmula WCAG 2.1:
   L = 0.2126 * R + 0.7152 * G + 0.0722 * B (onde R, G, B são linearizados)
   Contraste = (L1 + 0.05) / (L2 + 0.05) com L1 >= L2
   ========================================================================= */

function canalSRGBParaLinear(valor255: number): number {
  const norm = valor255 / 255;
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function calcularLuminanciaRelativa(hexCor: string): number {
  const limpo = hexCor.replace('#', '');
  const r = parseInt(limpo.substring(0, 2), 16);
  const g = parseInt(limpo.substring(2, 4), 16);
  const b = parseInt(limpo.substring(4, 6), 16);

  const rLin = canalSRGBParaLinear(r);
  const gLin = canalSRGBParaLinear(g);
  const bLin = canalSRGBParaLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function calcularRazaoContrasteWCAG(hexTexto: string, hexFundo: string): number {
  const lum1 = calcularLuminanciaRelativa(hexTexto);
  const lum2 = calcularLuminanciaRelativa(hexFundo);
  const lMaior = Math.max(lum1, lum2);
  const lMenor = Math.min(lum1, lum2);
  return (lMaior + 0.05) / (lMenor + 0.05);
}

const CABECALHO_PNG_MAGICO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('Suíte de Acessibilidade e D05 — Painel RPG (F5)', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  /* =========================================================================
     1. CONTRASTE WCAG AA (>= 4.5:1) NA PALETA NOITE DE VALFENDA E OURO VELHO
     ========================================================================= */
  describe('1. Contraste WCAG AA (>= 4.5:1) com oráculo independente', () => {
    const paresPaleta = [
      { texto: '#fef3c7', fundo: '#0c0a09', desc: 'âmbar-100 sobre stone-950 (título na noite)' },
      { texto: '#fef3c7', fundo: '#1c1917', desc: 'âmbar-100 sobre stone-900 (título no pergaminho)' },
      { texto: '#e7e5e4', fundo: '#0c0a09', desc: 'stone-200 sobre stone-950 (corpo na noite)' },
      { texto: '#e7e5e4', fundo: '#1c1917', desc: 'stone-200 sobre stone-900 (corpo no pergaminho)' },
      { texto: '#a8a29e', fundo: '#0c0a09', desc: 'stone-400 sobre stone-950 (secundário na noite)' },
      { texto: '#a8a29e', fundo: '#1c1917', desc: 'stone-400 sobre stone-900 (secundário no pergaminho)' },
      { texto: '#6ee7b7', fundo: '#022c22', desc: 'emerald-300 sobre emerald-950 (selo em dia)' },
      { texto: '#fde68a', fundo: '#451a03', desc: 'amber-200 sobre amber-950 (selo atenção)' },
      { texto: '#e9d5ff', fundo: '#3b0764', desc: 'purple-200 sobre purple-950 (selo névoa/desconhecido)' },
      { texto: '#fecdd3', fundo: '#4c0519', desc: 'rose-200 sobre rose-950 (selo erro/bloqueio)' },
    ];

    paresPaleta.forEach(({ texto, fundo, desc }) => {
      it(`garante contraste >= 4.5:1 para ${desc} (${texto} sobre ${fundo})`, () => {
        const razao = calcularRazaoContrasteWCAG(texto, fundo);
        expect(razao).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  /* =========================================================================
     1b. CONTRASTE DE TODO PAR TEXTO/FUNDO DA CASCA E DOS SELOS (COM OPACIDADE)
     Cada classe de cor de texto presente nos fontes tem de constar na tabela
     abaixo; cor nova sem par quebra o teste "cobertura".
     ========================================================================= */
  describe('1b. Pares texto/fundo da casca e do rpgTheme, com fundo composto', () => {
    const PALETA: Record<string, string> = {
      'stone-100': '#f5f5f4', 'stone-200': '#e7e5e4', 'stone-300': '#d6d3d1', 'stone-400': '#a8a29e',
      'stone-500': '#78716c', 'stone-600': '#57534e', 'stone-700': '#44403c', 'stone-800': '#292524',
      'stone-900': '#1c1917', 'stone-950': '#0c0a09',
      'amber-100': '#fef3c7', 'amber-200': '#fde68a', 'amber-300': '#fcd34d', 'amber-400': '#fbbf24',
      'amber-500': '#f59e0b', 'amber-950': '#451a03',
      'emerald-200': '#a7f3d0', 'emerald-300': '#6ee7b7', 'emerald-950': '#022c22',
      'purple-200': '#e9d5ff', 'purple-300': '#d8b4fe', 'purple-950': '#3b0764',
      'rose-200': '#fecdd3', 'rose-300': '#fda4af', 'rose-950': '#4c0519',
    };

    type RGB = [number, number, number];
    const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.substring(i, i + 2), 16)) as RGB;
    const hex = (c: RGB) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

    /** "stone-900/75" sobre a base. Sem barra, opacidade 100%. */
    function compor(base: RGB, camada: string): RGB {
      const [nome, op] = camada.split('/');
      const a = op === undefined ? 1 : Number(op) / 100;
      const c = rgb(PALETA[nome]);
      return [0, 1, 2].map((i) => a * c[i] + (1 - a) * base[i]) as RGB;
    }
    const fundoComposto = (camadas: string[]) => camadas.reduce<RGB>(compor, rgb(PALETA['stone-950']));

    /* Camadas de fundo reais, de baixo para cima (a base é sempre stone-950). */
    const CABECALHO = ['stone-900/95'];
    const LATERAL = ['stone-900/75'];
    const RESERVADO = ['stone-900/75', 'stone-950/40'];
    const BARRA_MOVEL = ['stone-900/95'];
    const CARTAO = ['stone-900/95'];
    const SELO_EM_DIA = ['stone-900/95', 'emerald-950/60'];
    const SELO_ATENCAO = ['stone-900/95', 'amber-950/60'];
    const SELO_DESC = ['stone-900/95', 'purple-950/60'];
    const SELO_ERRO = ['stone-900/95', 'rose-950/60'];

    const PARES: Record<string, string[][]> = {
      'text-stone-100': [[...LATERAL, 'stone-800/80']],
      'text-stone-200': [[], CABECALHO, CARTAO, ['purple-950/30'], ['rose-950/30'], BARRA_MOVEL],
      'text-stone-300': [LATERAL, CARTAO, ['stone-900/40'], ['stone-900/50']],
      'text-stone-400': [
        CABECALHO, LATERAL, [...LATERAL, 'amber-950/80'], RESERVADO, [...RESERVADO, 'stone-900'], BARRA_MOVEL, CARTAO,
        [...CARTAO, 'stone-900/70'], ['stone-950'],
      ],
      'text-amber-100': [CABECALHO, CARTAO, [...LATERAL, 'amber-950/80']],
      'text-amber-200': [
        SELO_ATENCAO, ['stone-950'], ['stone-900'], [...CARTAO, 'amber-950/80'],
        ['amber-950/20'],
      ],
      'text-amber-300': [[...BARRA_MOVEL, 'amber-950/50'], CARTAO],
      'text-amber-400': [['stone-950'], ['stone-900'], [...RESERVADO, 'stone-900']],
            'text-emerald-200': [['emerald-950/20']],
      'text-emerald-300': [SELO_EM_DIA, [...CARTAO, 'emerald-950/40']],
      'text-purple-200': [SELO_DESC],
      'text-purple-300': [CARTAO],
      'text-rose-200': [SELO_ERRO, ['rose-950/20']],
      'text-rose-300': [['rose-950/20', 'stone-950/80']],
    };
    // Texto com opacidade (ex.: amber-500/70): par próprio, texto composto sobre o fundo.
    const PARES_COM_OPACIDADE: Array<{ classe: string; fundos: string[][] }> = [
      { classe: 'text-amber-500/80', fundos: [LATERAL, BARRA_MOVEL] },
      { classe: 'text-amber-500/70', fundos: [RESERVADO] },
      { classe: 'text-amber-400/80', fundos: [['stone-900']] },
    ];

    const fontes = ['../app/PainelShell.tsx', '../app/rpgTheme.tsx'].map((f) =>
      fs.readFileSync(path.resolve(__dirname, f), 'utf-8'),
    );
    const RE_COR_TEXTO = /(?<![\w-])text-(?:stone|amber|emerald|purple|rose|slate|white|black)(?:-\d+)?(?:\/\d+)?/g;
    const classesNosFontes = new Set(fontes.flatMap((src) => src.match(RE_COR_TEXTO) ?? []));

    it('cobertura: toda cor de texto usada na casca e no rpgTheme tem par na tabela, e vice-versa', () => {
      const tabela = new Set([...Object.keys(PARES), ...PARES_COM_OPACIDADE.map((p) => p.classe)]);
      const semPar = [...classesNosFontes].filter((c) => !tabela.has(c));
      const sobrando = [...tabela].filter((c) => !classesNosFontes.has(c));
      expect(semPar).toEqual([]);
      expect(sobrando).toEqual([]);
    });

    const todos: Array<{ id: string; texto: RGB; fundo: RGB; fundoHex: string }> = [];
    Object.entries(PARES).forEach(([classe, lista]) => {
      lista.forEach((camadas) => {
        const nome = classe.replace('text-', '');
        const fundo = fundoComposto(camadas);
        todos.push({ id: `${classe} sobre [${camadas.join(' > ') || 'stone-950'}]`, texto: rgb(PALETA[nome]), fundo, fundoHex: hex(fundo) });
      });
    });
    PARES_COM_OPACIDADE.forEach(({ classe, fundos }) => {
      fundos.forEach((camadas) => {
        const fundo = fundoComposto(camadas);
        const texto = compor(fundo, classe.replace('text-', ''));
        todos.push({ id: `${classe} sobre [${camadas.join(' > ')}]`, texto, fundo, fundoHex: hex(fundo) });
      });
    });

    todos.forEach(({ id, texto, fundo, fundoHex }) => {
      it(`${id} (fundo composto ${fundoHex}) >= 4.5:1`, () => {
        expect(calcularRazaoContrasteWCAG(hex(texto), hex(fundo))).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  /* =========================================================================
     2. SEMÂNTICA SEM DEPENDER SÓ DE COR OU ORNAMENTO
     ========================================================================= */
  describe('2. Semântica com ícone/símbolo + rótulo textual explícito', () => {
    const cenariosEstado: Array<{
      estado: TipoEstadoRPG;
      simboloEsperado: string;
      rotuloEsperado: string;
    }> = [
      { estado: 'em_dia', simboloEsperado: '✓', rotuloEsperado: 'Em dia' },
      { estado: 'atencao', simboloEsperado: '!', rotuloEsperado: 'Atenção' },
      { estado: 'defasado', simboloEsperado: '!', rotuloEsperado: 'Defasado' },
      { estado: 'desconhecido', simboloEsperado: '?', rotuloEsperado: 'desconhecido' },
      { estado: 'erro', simboloEsperado: '✕', rotuloEsperado: 'Erro' },
    ];

    cenariosEstado.forEach(({ estado, simboloEsperado, rotuloEsperado }) => {
      it(`SeloEstado(${estado}) exibe símbolo "${simboloEsperado}" e texto "${rotuloEsperado}", sem ser região viva`, () => {
        const { container } = render(<SeloEstado estado={estado} />);
        const badge = container.firstElementChild as HTMLElement;
        expect(badge).toBeTruthy();
        expect(badge.getAttribute('role')).toBeNull();
        expect(badge.getAttribute('aria-live')).toBeNull();
        expect(within(badge).getByText(simboloEsperado)).toBeTruthy();
        expect(within(badge).getByText(rotuloEsperado)).toBeTruthy();
      });
    });

    it('HojePage exibe rótulos textuais e ícones nos selos sem depender exclusivamente de cor', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <PainelShell>
            <HojePage />
          </PainelShell>
        </MemoryRouter>
      );
      // Diário de Campo / névoa com "NUNCA EM DIA"
      expect(screen.getAllByText('NUNCA EM DIA').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Dados de exemplo')).toBeTruthy();
      expect(screen.getByText(/Espera pelo Conselho/i)).toBeTruthy();
    });

    it('ProjetosPage exibe selos semânticos com texto e símbolos', () => {
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByRole('complementary', { name: /Lista de Regiões/i })).toBeTruthy();
      expect(screen.getAllByText('NUNCA EM DIA').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* =========================================================================
     3. D05 NAS TRÊS TELAS (CONSELHO, REGIÕES, PALANTÍR): FOCO, ARIA E TOQUE
     ========================================================================= */
  describe('3. D05: Foco visível, rótulos ARIA e alvos de toque', () => {
    it('Casca comum (PainelShell) define navegação principal e móvel acessíveis', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <PainelShell>
            <div>Conteúdo de teste</div>
          </PainelShell>
        </MemoryRouter>
      );

      // 1. Rótulos ARIA na navegação principal e móvel
      const navPrincipal = screen.getByLabelText('Navegação Principal');
      expect(navPrincipal).toBeTruthy();
      const navMovel = screen.getByLabelText('Navegação Móvel');
      expect(navMovel).toBeTruthy();

      // 2. aria-current="page" na rota ativa ('/')
      const linkConselhoDesktop = within(navPrincipal).getByRole('link', { name: /O Conselho/i });
      expect(linkConselhoDesktop.getAttribute('aria-current')).toBe('page');

      // 3. Anel de foco visível (focus-visible:ring-2) em todos os links da casca
      const links = container.querySelectorAll('a');
      expect(links.length).toBeGreaterThanOrEqual(6);
      links.forEach((link) => {
        expect(link.className).toContain('focus-visible:ring-2');
        expect(link.className).toContain('min-h-[44px]');
      });

      // 4. aria-disabled="true" nos itens reservados com selo "Fase B · p3"
      const itensReservadosDesktop = container.querySelectorAll('aside [aria-disabled="true"]');
      expect(itensReservadosDesktop.length).toBeGreaterThanOrEqual(4);
      itensReservadosDesktop.forEach((item) => {
        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.textContent).toContain('Fase B · p3');
        expect(item.className).toContain('min-h-[44px]');
      });

      const todosReservados = container.querySelectorAll('[aria-disabled="true"]');
      todosReservados.forEach((item) => {
        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(item.className).toContain('min-h-[44px]');
      });
    });

    it('aria-current="page" alterna corretamente ao navegar entre rotas', () => {
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <PainelShell>
            <div>Conteúdo Regiões</div>
          </PainelShell>
        </MemoryRouter>
      );

      const navPrincipal = screen.getByLabelText('Navegação Principal');
      const linkRegioes = within(navPrincipal).getByRole('link', { name: /Regiões/i });
      expect(linkRegioes.getAttribute('aria-current')).toBe('page');

      const linkConselho = within(navPrincipal).getByRole('link', { name: /O Conselho/i });
      expect(linkConselho.getAttribute('aria-current')).toBeNull();
    });

    it('Pergaminho de Abertura possui <label htmlFor="..."> associado a cada <select> e alvos >= 44px', () => {
      const { container } = render(<PergaminhoAbertura />);

      const selects = container.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(5);

      selects.forEach((sel) => {
        expect(sel.id).toBeTruthy();
        const label = container.querySelector(`label[for="${sel.id}"]`);
        expect(label).toBeTruthy();
        expect(label?.textContent?.trim().length).toBeGreaterThan(0);
        expect(sel.className).toContain('min-h-[44px]');
        expect(sel.className).toContain('focus-visible:ring-2');
      });

      // Botão "Copiar mensagem" com min-h-[44px] e focus-visible:ring-2
      const botaoCopiar = screen.getByRole('button', { name: /Copiar mensagem/i });
      expect(botaoCopiar.className).toContain('min-h-[44px]');
      expect(botaoCopiar.className).toContain('focus-visible:ring-2');
    });

    it('MarcoJornada possui role="list", role="listitem" e aria-current="step" no marco ativo', () => {
      render(<MarcoJornada estacaoAtual="revisao" />);

      const lista = screen.getByRole('list');
      expect(lista).toBeTruthy();

      const itens = within(lista).getAllByRole('listitem');
      expect(itens.length).toBe(6);

      const itemRevisao = itens.find((it) => it.textContent?.includes('Revisão'));
      expect(itemRevisao).toBeTruthy();
      expect(itemRevisao?.getAttribute('aria-current')).toBe('step');

      const itemPedido = itens.find((it) => it.textContent?.includes('Pedido'));
      expect(itemPedido?.getAttribute('aria-current')).toBeNull();
    });

    it('ProjetosPage: passagens de Gwaihir controlam aria-expanded e foco visível ao alternar', () => {
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Botões de expansão de passagem em Mensagens de Gwaihir
      const botoesPassagem = screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-expanded') !== null
      );
      expect(botoesPassagem.length).toBeGreaterThan(0);

      const primeiroBotao = botoesPassagem[0];
      expect(primeiroBotao.getAttribute('aria-expanded')).toBe('false');
      expect(primeiroBotao.className).toContain('min-h-[44px]');
      expect(primeiroBotao.className).toContain('focus-visible:ring-2');

      // Expande ao clicar
      fireEvent.click(primeiroBotao);
      expect(primeiroBotao.getAttribute('aria-expanded')).toBe('true');

      // Recolhe ao clicar novamente
      fireEvent.click(primeiroBotao);
      expect(primeiroBotao.getAttribute('aria-expanded')).toBe('false');
    });
  });

  /* =========================================================================
     4. COBERTURA DOS 5 ESTADOS DE TELA (D05): CARREGANDO, VAZIO, ERRO, PARCIAL, SUCESSO
     ========================================================================= */
  describe('4. Cobertura dos 5 estados de tela (D05) em HojePage e ProjetosPage', () => {
    // 4.1 HojePage
    it('HojePage: cobre estado "carregando" com role="status"', () => {
      usePainelStore.setState({ estado: 'carregando', dados: null, erros: [] });
      render(<HojePage />);
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('Reunindo o Conselho...');
    });

    it('HojePage: cobre estado "vazio" com role="status"', () => {
      usePainelStore.setState({ estado: 'vazio', dados: cenarioVazio, erros: [] });
      render(<HojePage />);
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('Conselho sem registros');
    });

    it('HojePage: cobre estado "erro" com role="alert" e lista de erros', () => {
      usePainelStore.setState({
        estado: 'erro',
        dados: null,
        erros: ['Campo projetos ausente', 'pacote inválido'],
      });
      render(<HojePage />);
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('Instantâneo inválido');
      expect(alerta.textContent).toContain('Campo projetos ausente');
    });

    it('HojePage: cobre estado "parcial" exibindo aviso status e painel', () => {
      usePainelStore.setState({
        estado: 'parcial',
        dados: exemploOficial,
        erros: [],
      });
      render(<HojePage />);
      expect(screen.getByText('Leitura parcial')).toBeTruthy();
      expect(screen.getByRole('heading', { name: /I\. Espera pelo Conselho/i })).toBeTruthy();
    });

    it('HojePage: cobre estado "sucesso" exibindo todas as 4 seções', () => {
      usePainelStore.setState({
        estado: 'sucesso',
        dados: exemploOficial,
        erros: [],
      });
      render(<HojePage />);
      expect(screen.getByRole('heading', { name: /I\. Espera pelo Conselho/i })).toBeTruthy();
      expect(screen.getByRole('heading', { name: /II\. Terras em Névoa/i })).toBeTruthy();
      expect(screen.getByRole('heading', { name: /III\. Forjas e Núcleos/i })).toBeTruthy();
      expect(screen.getByRole('heading', { name: /IV\. Pergaminho de Abertura/i })).toBeTruthy();
    });

    // 4.2 ProjetosPage
    it('ProjetosPage: cobre estado "carregando" com role="status"', () => {
      usePainelStore.setState({ estado: 'carregando', dados: null, erros: [] });
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('Mapeando as Regiões...');
    });

    it('ProjetosPage: cobre estado "vazio" com role="status"', () => {
      usePainelStore.setState({ estado: 'vazio', dados: cenarioVazio, erros: [] });
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );
      const status = screen.getByRole('status');
      expect(status.textContent).toContain('Nenhuma Região Mapeada');
    });

    it('ProjetosPage: cobre estado "erro" com role="alert" e lista de erros', () => {
      usePainelStore.setState({
        estado: 'erro',
        dados: null,
        erros: ['Falha estrutural no contrato de projetos'],
      });
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('Falha ao Mapear as Regiões');
      expect(alerta.textContent).toContain('Falha estrutural no contrato de projetos');
    });

    it('ProjetosPage: cobre estado "parcial" exibindo aviso status e detalhes de região', () => {
      usePainelStore.setState({
        estado: 'parcial',
        dados: exemploOficial,
        erros: [],
      });
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );
      expect(screen.getByText('Leitura parcial')).toBeTruthy();
      expect(screen.getByRole('complementary', { name: /Lista de Regiões/i })).toBeTruthy();
    });

    it('ProjetosPage: cobre estado "sucesso" exibindo lista de regiões e detalhes', () => {
      usePainelStore.setState({
        estado: 'sucesso',
        dados: exemploOficial,
        erros: [],
      });
      render(
        <MemoryRouter initialEntries={['/projetos']}>
          <Routes>
            <Route path="/projetos" element={<ProjetosPage />} />
          </Routes>
        </MemoryRouter>
      );
      const lista = screen.getByRole('complementary', { name: /Lista de Regiões/i });
      expect(lista).toBeTruthy();
      expect(within(lista).getByText('Loja Exemplo')).toBeTruthy();
      expect(within(lista).getByText('App Receitas')).toBeTruthy();
    });
  });

  /* =========================================================================
     5. VERIFICAÇÃO DAS 6 CAPTURAS GERADAS PELO PLAYWRIGHT
     ========================================================================= */
  describe('5. Verificação das 6 capturas geradas em e2e/capturas/', () => {
    const capturasEsperadas = [
      'conselho-1280x800.png',
      'conselho-360x820.png',
      'regioes-1280x800.png',
      'regioes-360x820.png',
      'palantir-1280x800.png',
      'palantir-360x820.png',
    ];

    const capturasDir = path.resolve('e2e/capturas');

    capturasEsperadas.forEach((nomeArquivo) => {
      it(`captura "${nomeArquivo}" existe, tem cabeçalho PNG válido e tamanho > 1024 bytes`, () => {
        const caminhoCompleto = path.join(capturasDir, nomeArquivo);
        expect(fs.existsSync(caminhoCompleto)).toBe(true);

        const stats = fs.statSync(caminhoCompleto);
        expect(stats.size).toBeGreaterThan(1024);

        // Confere os 8 primeiros bytes (magic bytes do formato PNG: \x89PNG\r\n\x1a\n)
        const fd = fs.openSync(caminhoCompleto, 'r');
        const buffer = Buffer.alloc(8);
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);

        expect(buffer.equals(CABECALHO_PNG_MAGICO)).toBe(true);
      });
    });
  });
});
