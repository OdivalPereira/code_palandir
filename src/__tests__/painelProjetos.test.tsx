import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProjetosPage } from '../painel/projetos/ProjetosPage';
import { usePainelStore } from '../stores/painelStore';
import { exemploOficial } from '../painel/fixtures/cenarios';
import type { Painel1 } from '../painel/contrato/painel1.types';

describe('ProjetosPage — Regiões e Jornada (F4)', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  const renderComRouter = (rotaInicial = '/projetos') => {
    return render(
      <MemoryRouter initialEntries={[rotaInicial]}>
        <Routes>
          <Route path="/projetos" element={<ProjetosPage />} />
          <Route path="/projetos/:id" element={<ProjetosPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('1. exibe a Lista de Regiões com Loja Exemplo, App Receitas e Diário de Campo', () => {
    renderComRouter('/projetos');

    const lista = screen.getByRole('complementary', { name: /Lista de Regiões/i });
    expect(lista).toBeTruthy();

    // Confere nomes das regiões
    expect(within(lista).getByText('Loja Exemplo')).toBeTruthy();
    expect(within(lista).getByText('App Receitas')).toBeTruthy();
    expect(within(lista).getByText('Diário de Campo')).toBeTruthy();

    // Loja Exemplo: núcleo 3.4.0 em dia, estação revisao, 3 pendências
    expect(within(lista).getByText('3.4.0')).toBeTruthy();
    expect(within(lista).getByText('revisao')).toBeTruthy();
    expect(within(lista).getByText(/3 pendências/i)).toBeTruthy();

    // App Receitas: núcleo 3.1.0 defasado, estação ordem, 2 pendências
    expect(within(lista).getByText(/3\.1\.0 ! defasado/i)).toBeTruthy();
    expect(within(lista).getByText('ordem')).toBeTruthy();
    expect(within(lista).getByText(/2 pendências/i)).toBeTruthy();

    // Diário de Campo: núcleo desconhecido, estação desconhecida, 3 diagnósticos, NUNCA EM DIA
    expect(within(lista).getByText(/nucleo: desconhecido/i)).toBeTruthy();
    expect(within(lista).getByText(/desconhecida \?/i)).toBeTruthy();
    expect(within(lista).getByText(/\? 3 diagnósticos · estado desconhecido/i)).toBeTruthy();
    expect(within(lista).getByText('NUNCA EM DIA')).toBeTruthy();
  });

  it('2. exibe os Marcos da Jornada de Loja Exemplo com e3-carrinho (revisao) e e2-catalogo (encerrada)', () => {
    renderComRouter('/projetos/loja-exemplo');

    const secaoMarcos = screen.getByTestId('secao-marcos-jornada');

    // Etapa e3-carrinho em revisão
    expect(within(secaoMarcos).getByText('e3-carrinho')).toBeTruthy();
    expect(within(secaoMarcos).getAllByText(/revisao/i).length).toBeGreaterThanOrEqual(1);

    // Etapa e2-catalogo encerrada com aceitar e Grau A
    expect(within(secaoMarcos).getByText('e2-catalogo')).toBeTruthy();
    expect(
      within(secaoMarcos).getAllByText(/Encerrada \(aceitar · Grau A\)/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('3. exibe os Acampamentos de Loja Exemplo (claude limpa, codex clone suja, antigravity worktree limpa)', () => {
    renderComRouter('/projetos/loja-exemplo');

    const secaoAcampamentos = screen.getByTestId('secao-acampamentos');

    // claude: canônica, limpa, main, sha abc1234
    expect(within(secaoAcampamentos).getByText('claude')).toBeTruthy();
    expect(within(secaoAcampamentos).getByText('/home/dono/Projetos/loja-exemplo')).toBeTruthy();

    // codex: clone com alerta, suja, main, sha 9f8e7d6
    expect(within(secaoAcampamentos).getByText('codex')).toBeTruthy();
    expect(within(secaoAcampamentos).getByText('! clone')).toBeTruthy();
    expect(within(secaoAcampamentos).getByText('suja')).toBeTruthy();
    expect(within(secaoAcampamentos).getByText('/home/dono/Projetos/loja-exemplo-codex')).toBeTruthy();

    // antigravity: worktree, limpa, etapa/e3-carrinho, sha 1a2b3c4
    expect(within(secaoAcampamentos).getByText('antigravity')).toBeTruthy();
    expect(within(secaoAcampamentos).getByText('worktree')).toBeTruthy();
    expect(
      within(secaoAcampamentos).getByText('/home/dono/.sociedade/trabalho/loja-exemplo/e3-carrinho')
    ).toBeTruthy();

    // Confere selos de limpa
    const selosLimpa = within(secaoAcampamentos).getAllByText('limpa');
    expect(selosLimpa.length).toBeGreaterThanOrEqual(2);
  });

  it('4. exibe a Companhia de Loja Exemplo com aviso quando modelo_no_log é null e quando diverge', async () => {
    const { unmount } = renderComRouter('/projetos/loja-exemplo');

    const secaoCompanhia = screen.getByTestId('secao-companhia');

    // Ocupantes esperados
    expect(within(secaoCompanhia).getAllByText(/Claude Opus 5\.5/i).length).toBeGreaterThanOrEqual(1);
    expect(within(secaoCompanhia).getAllByText(/Gemini 3\.8 Flash/i).length).toBeGreaterThanOrEqual(1);
    expect(within(secaoCompanhia).getAllByText(/GPT-6\.1-Sol/i).length).toBeGreaterThanOrEqual(1);

    // Revisor GPT-6.1-Sol tem modelo_no_log: null
    expect(within(secaoCompanhia).getByText('modelo_no_log: desconhecido (null)')).toBeTruthy();
    expect(
      within(secaoCompanhia).getByText('modelo do log ainda não lido: conversa em andamento')
    ).toBeTruthy();

    unmount();

    // Testa caso de divergência de modelo_no_log
    const copiaComDivergencia: Painel1 = JSON.parse(JSON.stringify(exemploOficial));
    const interacoes = copiaComDivergencia.projetos[0]?.etapas[1]?.interacoes;
    if (interacoes && interacoes[0]) {
      interacoes[0].modelo_no_log = 'Claude Haiku 5.5';
    }

    await act(async () => {
      usePainelStore.getState().carregarDadoBruto(copiaComDivergencia);
    });

    renderComRouter('/projetos/loja-exemplo');
    expect(screen.getAllByText('modelo_no_log diverge: Claude Haiku 5.5').length).toBeGreaterThanOrEqual(1);
  });

  it('5. inicia Mensagens de Gwaihir recolhidas por padrão e expande o bloco ao clicar', () => {
    renderComRouter('/projetos/loja-exemplo');

    // Botões de passagem
    const botaoPassagem1 = screen.getByRole('button', {
      name: /coordenador → arquiteto/i,
    });
    const botaoPassagem2 = screen.getByRole('button', {
      name: /arquiteto → revisor/i,
    });

    expect(botaoPassagem1).toBeTruthy();
    expect(botaoPassagem2).toBeTruthy();

    // Iniciam recolhidas
    expect(botaoPassagem1.getAttribute('aria-expanded')).toBe('false');
    expect(botaoPassagem2.getAttribute('aria-expanded')).toBe('false');

    // O conteúdo do bloco D-COM-001 NÃO está visível antes de clicar
    expect(
      screen.queryByText(/Para: Círdan · De: Gandalf · Etapa: e3-carrinho/i)
    ).toBeNull();

    // Clica para expandir
    fireEvent.click(botaoPassagem1);

    expect(botaoPassagem1.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText(/Para: Círdan · De: Gandalf · Etapa: e3-carrinho/i)
    ).toBeTruthy();

    // Clica novamente para recolher
    fireEvent.click(botaoPassagem1);
    expect(botaoPassagem1.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByText(/Para: Círdan · De: Gandalf · Etapa: e3-carrinho/i)
    ).toBeNull();
  });

  it('6. exibe Diário de Campo com campos desconhecidos (D08), estação desconhecida e seus 3 diagnósticos', () => {
    renderComRouter('/projetos/diario-campo');

    // Núcleo desconhecido
    expect(screen.getAllByText(/nucleo: desconhecido/i).length).toBeGreaterThanOrEqual(1);

    // Acampamento com ramo, sha e limpa desconhecidos
    expect(screen.getByText(/ramo: desconhecido/i)).toBeTruthy();
    expect(screen.getByText(/sha: desconhecido/i)).toBeTruthy();
    expect(screen.getByText(/limpa: desconhecida/i)).toBeTruthy();

    // Estação desconhecida
    expect(screen.getAllByText(/desconhecida/i).length).toBeGreaterThanOrEqual(1);

    // Os 3 diagnósticos de Diário de Campo
    expect(screen.getByText(/AGENTS\.md sem o bloco da Sociedade/i)).toBeTruthy();
    expect(
      screen.getByText(/sociedade\/registro\.json ilegível \(JSON inválido na linha 3\)/i)
    ).toBeTruthy();
    expect(screen.getByText(/pasta sem repositório Git/i)).toBeTruthy();

    // Selos de alerta
    expect(screen.getAllByText('NUNCA EM DIA').length).toBeGreaterThanOrEqual(1);
  });

  it('7. trata os estados D05: carregando, vazio, erro e parcial', () => {
    // Estado: carregando
    usePainelStore.getState().definirEstado('carregando');
    const { unmount: unmount1 } = renderComRouter('/projetos');
    expect(screen.getByText(/Mapeando as Regiões\.\.\./i)).toBeTruthy();
    unmount1();

    // Estado: erro
    usePainelStore.getState().definirEstado('erro', ['Erro simulado de contrato']);
    const { unmount: unmount2 } = renderComRouter('/projetos');
    expect(screen.getByText(/Falha ao Mapear as Regiões/i)).toBeTruthy();
    expect(screen.getByText(/Erro simulado de contrato/i)).toBeTruthy();
    unmount2();

    // Estado: vazio
    usePainelStore.getState().definirEstado('vazio');
    const { unmount: unmount3 } = renderComRouter('/projetos');
    expect(screen.getByText(/Nenhuma Região Mapeada/i)).toBeTruthy();
    unmount3();

    // Estado: parcial
    usePainelStore.getState().resetar();
    usePainelStore.getState().definirEstado('parcial');
    const { unmount: unmount4 } = renderComRouter('/projetos');
    expect(screen.getByText(/Leitura parcial/i)).toBeTruthy();
    // Confere que o conteúdo também é exibido mesmo em leitura parcial
    expect(screen.getAllByText('Loja Exemplo').length).toBeGreaterThanOrEqual(1);
    unmount4();
  });

  it('8. sincroniza a seleção ao clicar em outra região na Lista de Regiões', () => {
    renderComRouter('/projetos/loja-exemplo');

    // Inicialmente Loja Exemplo está selecionada
    expect(screen.getByRole('heading', { level: 1, name: 'Loja Exemplo' })).toBeTruthy();

    // Clica em App Receitas na lista
    const botaoAppReceitas = screen.getByRole('button', { name: /App Receitas/i });
    fireEvent.click(botaoAppReceitas);

    // Detalhe agora mostra App Receitas
    expect(screen.getByRole('heading', { level: 1, name: 'App Receitas' })).toBeTruthy();
    expect(screen.getByText('r1-busca')).toBeTruthy();
  });
});
