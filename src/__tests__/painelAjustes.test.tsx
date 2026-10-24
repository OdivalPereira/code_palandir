import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PainelShell, tituloDaRota } from '../app/PainelShell';
import { PaginaNaoEncontrada, ROUTER_FUTURE } from '../app/App';
import { MarcoJornada } from '../app/rpgTheme';
import { ProjetosPage } from '../painel/projetos/ProjetosPage';
import { HojePage } from '../painel/hoje/HojePage';
import { PergaminhoAbertura } from '../painel/mensagem/PergaminhoAbertura';
import { montarAbertura, selecaoInicial } from '../painel/mensagem/escalaAbertura';
import * as clipboardService from '@/services/clipboard';
import { copyToClipboard } from '@/services/clipboard';
import { formatarColetadoEm, pluralizar } from '../painel/formatacao';
import { exemploOficial } from '../painel/fixtures/cenarios';
import { usePainelStore } from '../stores/painelStore';
import type { Painel1 } from '../painel/contrato/painel1.types';
import type { Fonte, ResultadoFonte } from '../painel/fonte/Fonte';

function renderShell(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <PainelShell>
        <p>conteúdo</p>
      </PainelShell>
    </MemoryRouter>
  );
}

describe('formatacao', () => {
  it('formata o instante da coleta em UTC', () => {
    expect(formatarColetadoEm('2026-10-23T15:00:00Z')).toBe('23/10 15:00Z');
    expect(formatarColetadoEm('2026-01-05T03:07:00-03:00')).toBe('05/01 06:07Z');
  });

  it('instante ausente ou ilegível vira desconhecido (D08)', () => {
    expect(formatarColetadoEm(null)).toBe('data desconhecida');
    expect(formatarColetadoEm('')).toBe('data desconhecida');
    expect(formatarColetadoEm('ontem')).toBe('data desconhecida');
  });

  it('concorda o número com o substantivo', () => {
    expect(pluralizar(0, 'pendência', 'pendências')).toBe('0 pendências');
    expect(pluralizar(1, 'pendência', 'pendências')).toBe('1 pendência');
    expect(pluralizar(5, 'pendência', 'pendências')).toBe('5 pendências');
  });
});

describe('Casca: cabeçalho lê o instantâneo', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  it('mostra a máquina e a hora do instantâneo carregado, não valores fixos', () => {
    usePainelStore.setState({
      dados: { ...exemploOficial, maquina: 'desktop-teste', coletado_em: '2026-11-02T08:30:00Z' },
    });
    renderShell();
    expect(screen.getByText('desktop-teste')).toBeTruthy();
    const hora = screen.getByText('02/11 08:30Z');
    expect(hora.tagName).toBe('TIME');
    expect(hora.getAttribute('datetime')).toBe('2026-11-02T08:30:00Z');
    expect(screen.queryByText('notebook-exemplo')).toBeNull();
  });

  it('sem instantâneo, diz que não há instantâneo', () => {
    usePainelStore.setState({ dados: null, estado: 'erro' });
    renderShell();
    expect(screen.getByText('sem instantâneo')).toBeTruthy();
  });
});

describe('Regiões: selos que não afirmam o que não sabem', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  const renderProjetos = (rota: string) =>
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/projetos" element={<ProjetosPage />} />
          <Route path="/projetos/:id" element={<ProjetosPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('projeto com pendências não aparece como "Em dia" no cabeçalho', () => {
    renderProjetos('/projetos/loja-exemplo');
    const detalhe = screen.getByRole('region', { name: /Detalhes da Região Loja Exemplo/i });
    expect(within(detalhe).queryByText('Em dia')).toBeNull();
    expect(within(detalhe).getByText('3 pendências')).toBeTruthy();
  });

  it('projeto sem pendência, sem diagnóstico e com núcleo em dia aparece "Em dia"', () => {
    const loja = exemploOficial.projetos.find((p) => p.id === 'loja-exemplo')!;
    usePainelStore.setState({
      dados: { ...exemploOficial, projetos: [{ ...loja, pendencias: [] }] },
    });
    renderProjetos('/projetos/loja-exemplo');
    const detalhe = screen.getByRole('region', { name: /Detalhes da Região Loja Exemplo/i });
    expect(within(detalhe).getByText('Em dia')).toBeTruthy();
  });

  it('projeto com diagnósticos conta só as pendências conhecidas, sem "?" duplicado', () => {
    renderProjetos('/projetos');
    const lista = screen.getByRole('complementary', { name: /Lista de Regiões/i });
    expect(within(lista).getByText('0 pendências conhecidas')).toBeTruthy();
    expect(within(lista).getByText('3 diagnósticos · estado desconhecido')).toBeTruthy();
    expect(within(lista).queryByText(/\? \d+ diagnósticos/)).toBeNull();
  });

  it('o detalhe não cria um segundo <main> dentro da casca', () => {
    const { container } = renderProjetos('/projetos/loja-exemplo');
    expect(container.querySelectorAll('main')).toHaveLength(0);
  });

  it('id que não está no instantâneo mostra "Região não encontrada", não outro projeto', () => {
    renderProjetos('/projetos/nao-existe');
    expect(screen.getByText('Região não encontrada')).toBeTruthy();
    expect(screen.getByText(/"nao-existe" não está no instantâneo/)).toBeTruthy();
    expect(screen.queryByText('Loja Exemplo')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver todas as regiões' }).getAttribute('href')).toBe(
      '/projetos'
    );
    expect(usePainelStore.getState().projetoSelecionadoId).toBe('loja-exemplo');
  });
});

describe('Conselho e Pergaminho', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('contagem de pendências concorda em número', () => {
    render(
      <MemoryRouter>
        <HojePage />
      </MemoryRouter>
    );
    expect(screen.getByText('5 pendências conhecidas')).toBeTruthy();
    expect(screen.queryByText(/pendência\(s\)/)).toBeNull();
  });

  it('a região de anúncio da cópia existe antes do clique', () => {
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={exemploOficial.cardapio} />);
    const vivas = document.querySelectorAll('[role="status"][aria-live="polite"]');
    expect(vivas.length).toBeGreaterThan(0);
  });

  it('cópia que falha avisa em vez de ficar calada', async () => {
    vi.spyOn(clipboardService, 'copyToClipboard').mockResolvedValue(false);
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={exemploOficial.cardapio} />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(await screen.findByText(/Não deu para copiar/)).toBeTruthy();
    expect(screen.queryByText(/Mensagem copiada!/)).toBeNull();
  });

  it('mudar a escolha depois de copiar apaga o aviso', async () => {
    vi.spyOn(clipboardService, 'copyToClipboard').mockResolvedValue(true);
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={exemploOficial.cardapio} />);
    fireEvent.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(await screen.findByText(/Mensagem copiada!/)).toBeTruthy();
    fireEvent.change(document.getElementById('pergaminho-papel')!, { target: { value: 'arquiteto' } });
    expect(screen.queryByText(/Mensagem copiada!/)).toBeNull();
  });
});

describe('copyToClipboard (alternativa por textarea)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devolve o foco ao botão e não deixa textarea para trás', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof exec }).execCommand = exec;
    const botao = document.createElement('button');
    document.body.appendChild(botao);
    botao.focus();

    expect(await copyToClipboard('texto')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.activeElement).toBe(botao);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    botao.remove();
  });

  it('remove a textarea mesmo quando o navegador recusa a cópia', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    (document as unknown as { execCommand: () => boolean }).execCommand = () => {
      throw new Error('negado');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await copyToClipboard('texto')).toBe(false);
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });
});

describe('Rotas', () => {
  it('caminho desconhecido mostra "Caminho fora do mapa" com volta ao Conselho', () => {
    render(
      <MemoryRouter initialEntries={['/nada-aqui']} future={ROUTER_FUTURE}>
        <Routes>
          <Route path="/" element={<p>conselho</p>} />
          <Route path="*" element={<PaginaNaoEncontrada />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Caminho fora do mapa')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao Conselho' }));
    expect(screen.getByText('conselho')).toBeTruthy();
  });
});

describe('D08 e D05: o que não se sabe não aparece como resolvido', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  const loja = exemploOficial.projetos.find((p) => p.id === 'loja-exemplo')!;

  const renderProjetos = (rota: string) =>
    render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/projetos" element={<ProjetosPage />} />
          <Route path="/projetos/:id" element={<ProjetosPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('Conselho sem pendências mas com projeto ilegível não mostra o ✓ em dia', () => {
    usePainelStore.setState({
      dados: {
        ...exemploOficial,
        projetos: exemploOficial.projetos.map((p) => ({ ...p, pendencias: [] })),
      },
    });
    render(
      <MemoryRouter>
        <HojePage />
      </MemoryRouter>
    );
    expect(screen.getByText('0 pendências conhecidas')).toBeTruthy();
    expect(screen.queryByText('0 pendências')).toBeNull();
  });

  it('etapa encerrada sem decisão nem grau não imprime "null"', () => {
    const etapa = { ...loja.etapas[0], estacao: 'encerrada' as const, decisao: null, grau: null };
    usePainelStore.setState({
      dados: { ...exemploOficial, projetos: [{ ...loja, etapas: [etapa] }] },
    });
    renderProjetos('/projetos/loja-exemplo');
    expect(screen.queryByText(/null/)).toBeNull();
    expect(screen.getAllByText(/Encerrada \(sem decisão · Grau —\)/).length).toBeGreaterThan(0);
  });

  it('núcleo desconhecido não é chamado de defasado no cabeçalho', () => {
    usePainelStore.setState({
      dados: {
        ...exemploOficial,
        diagnosticos: [],
        projetos: [{ ...loja, nucleo: null, pendencias: [] }],
      },
    });
    renderProjetos('/projetos/loja-exemplo');
    const detalhe = screen.getByRole('region', { name: /Detalhes da Região Loja Exemplo/i });
    expect(within(detalhe).getByText('núcleo desconhecido')).toBeTruthy();
    expect(within(detalhe).queryByText(/fora de dia|defasado/)).toBeNull();
  });

  it('passagem aberta num projeto não abre sozinha no outro com etapa de mesmo id', () => {
    const etapaCom = (bloco: string) => ({
      ...loja.etapas[0],
      id: 'e1',
      passagens: [{ de: 'arquiteto', para: 'coordenador', quando: '2026-10-20T10:00:00Z', bloco }],
    });
    usePainelStore.setState({
      dados: {
        ...exemploOficial,
        diagnosticos: [],
        projetos: [
          { ...loja, id: 'p1', nome: 'Projeto Um', etapas: [etapaCom('BLOCO-Alfa')] },
          { ...loja, id: 'p2', nome: 'Projeto Dois', etapas: [etapaCom('BLOCO-Beta')] },
        ],
      },
      projetoSelecionadoId: 'p1',
    });
    renderProjetos('/projetos/p1');
    fireEvent.click(screen.getByRole('button', { name: /arquiteto → coordenador/ }));
    expect(screen.getByText('BLOCO-Alfa')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Projeto Dois/ }));
    expect(screen.queryByText('BLOCO-Beta')).toBeNull();
  });

  it('fonte que rejeita leva ao estado de erro, não a "carregando" para sempre', async () => {
    const fonte: Fonte = { modo: 'supabase', carregar: () => Promise.reject(new Error('rede fora')) };
    await usePainelStore.getState().carregar(fonte);
    const st = usePainelStore.getState();
    expect(st.estado).toBe('erro');
    expect(st.dados).toBeNull();
    expect(st.erros[0]).toContain('rede fora');
  });

  it('resposta lenta de um carregar antigo não sobrescreve a mais nova', async () => {
    let soltarLenta: (r: ResultadoFonte<Painel1>) => void = () => {};
    const lenta: Fonte = {
      modo: 'supabase',
      carregar: () => new Promise((res) => (soltarLenta = res)),
    };
    const nova: Fonte = {
      modo: 'supabase',
      carregar: async () => ({
        estado: 'sucesso',
        dados: { ...exemploOficial, maquina: 'nova' },
        erros: [],
        modo: 'supabase',
      }),
    };
    const p1 = usePainelStore.getState().carregar(lenta);
    await usePainelStore.getState().carregar(nova);
    soltarLenta({ estado: 'sucesso', dados: { ...exemploOficial, maquina: 'velha' }, erros: [], modo: 'supabase' });
    await p1;
    expect(usePainelStore.getState().dados?.maquina).toBe('nova');
  });
});

describe('Pergaminho: valores do instantâneo não viram comando na linha Assumir', () => {
  const loja = exemploOficial.projetos.find((p) => p.id === 'loja-exemplo')!;
  const cardapio = exemploOficial.cardapio ?? [];
  const comEtapa = (etapaId: string) => [
    { ...loja, etapas: [{ ...loja.etapas[1], id: etapaId, estacao: 'execucao' as const }] },
  ];

  it('o exemplo oficial continua gerando a mensagem', () => {
    const r = montarAbertura(exemploOficial.projetos, cardapio, selecaoInicial());
    expect(r.mensagem).not.toBeNull();
    expect(r.bloqueios).toEqual([]);
  });

  it.each([
    'x; touch /tmp/pwn #',
    'e1 --plataforma "evil"',
    '../../etc',
    'e1$(id)',
    'e1\nrm -rf ~',
  ])('etapa com id %j bloqueia a mensagem', (etapaId) => {
    const r = montarAbertura(comEtapa(etapaId), cardapio, selecaoInicial());
    expect(r.mensagem).toBeNull();
    expect(r.bloqueios.join(' ')).toMatch(/não é seguro para a linha Assumir/);
  });

  it('modelo do cardápio com aspas e $( ) bloqueia, com o motivo', () => {
    const ruim = cardapio.map((c) =>
      c.plataforma === 'Antigravity' && c.nivel === 'moderada' ? { ...c, modelo: 'm" $(id) `id`' } : c
    );
    const r = montarAbertura(exemploOficial.projetos, ruim, selecaoInicial());
    expect(r.mensagem).toBeNull();
    expect(r.bloqueios.join(' ')).toMatch(/modelo .* terminal interpretaria/);
  });

  it('subagente com vírgula quebraria --subagentes e bloqueia', () => {
    const ruim = cardapio.map((c) =>
      c.plataforma === 'Antigravity' && c.nivel === 'alta' ? { ...c, modelo: 'Argon,simples=x' } : c
    );
    const r = montarAbertura(exemploOficial.projetos, ruim, selecaoInicial());
    expect(r.mensagem).toBeNull();
    expect(r.bloqueios.join(' ')).toMatch(/subagente \(alta\)/);
  });
});

describe('Casca: navegação acessível', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  it('nomeia cada tela pela rota', () => {
    expect(tituloDaRota('/')).toBe('O Conselho');
    expect(tituloDaRota('/projetos')).toBe('Regiões');
    expect(tituloDaRota('/projetos/loja-exemplo')).toBe('Regiões');
    expect(tituloDaRota('/analisador')).toBe('Palantír — Analisador');
    expect(tituloDaRota('/etapas/x')).toBe('Caminho fora do mapa');
  });

  it('põe o nome da tela no título da aba e oferece pular para o conteúdo', () => {
    renderShell('/projetos/loja-exemplo');
    expect(document.title).toBe('Regiões · Code Palandir');
    const pular = screen.getByRole('link', { name: 'Pular para o conteúdo' });
    expect(pular.getAttribute('href')).toBe('#conteudo');
    expect(document.getElementById('conteudo')?.tagName).toBe('MAIN');
  });

  it('o item reservado da barra móvel diz o que é', () => {
    renderShell('/');
    const movel = screen.getByRole('navigation', { name: 'Navegação Móvel' });
    expect(within(movel).getByText('Sociedade')).toBeTruthy();
    expect(within(movel).getByText(/reservado para a fase B, p3/)).toBeTruthy();
  });
});

describe('MarcoJornada', () => {
  it('é um grupo rotulado, não um landmark de navegação', () => {
    render(<MarcoJornada estacaoAtual="revisao" rotulo="Marcos da etapa e3-carrinho" />);
    expect(screen.getByRole('group', { name: 'Marcos da etapa e3-carrinho' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('diz em texto quais estações foram concluídas, além da cor', () => {
    render(<MarcoJornada estacaoAtual="revisao" />);
    const itens = screen.getAllByRole('listitem');
    expect(itens[0].textContent).toContain('(concluída)');
    expect(itens[4].textContent).toContain('(estação atual)');
    expect(itens[5].textContent).toContain('(a percorrer)');
  });

  it('jornada encerrada marca as seis estações como concluídas', () => {
    render(<MarcoJornada estacaoAtual="encerrada" />);
    for (const item of screen.getAllByRole('listitem')) {
      expect(item.textContent).toContain('(concluída)');
    }
  });
});

describe('Regiões: uma tela, muitos selos, nenhuma região viva extra', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });
  it('a tela Regiões não tem dezenas de role=status', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/projetos/loja-exemplo']}>
        <Routes>
          <Route path="/projetos/:id" element={<ProjetosPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container.querySelectorAll('[role="status"]').length).toBeLessThanOrEqual(1);
  });
});
