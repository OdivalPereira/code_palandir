import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HojePage } from '../painel/hoje/HojePage';
import { exemploOficial } from '../painel/fixtures/cenarios';
import { usePainelStore } from '../stores/painelStore';
import type { Painel1 } from '../painel/contrato/painel1.types';
import * as clipboardService from '@/services/clipboard';

describe('HojePage — O Conselho e Pergaminho de Abertura (F3)', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  it('renderiza as 4 seções da tela Hoje e o layout 7/12 e 5/12 sobre o exemploOficial', () => {
    const { container } = render(<HojePage />);

    expect(
      screen.getByRole('heading', { name: /I\. Espera pelo Conselho/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /II\. Terras em Névoa · Desconhecido/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /III\. Forjas e Núcleos/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /IV\. Pergaminho de Abertura/i })
    ).toBeTruthy();

    expect(container.querySelector('.xl\\:col-span-7')).toBeTruthy();
    expect(container.querySelector('.xl\\:col-span-5')).toBeTruthy();
  });

  it('exibe as 5 pendências do exemplo na ordem estrita da seção 5.3', () => {
    render(<HojePage />);

    const listaPendencias = screen.getByRole('list', {
      name: /Lista de pendências do Conselho/i,
    });
    const itens = within(listaPendencias).getAllByRole('listitem');
    expect(itens).toHaveLength(5);

    expect(itens[0].textContent).toContain('APROVAR ORDEM');
    expect(itens[0].textContent).toContain('App Receitas · r1-busca');
    expect(itens[0].textContent).toContain(
      'Ordem r1-busca escrita pelo Círdan; falta a sua aprovação'
    );

    expect(itens[1].textContent).toContain('REVISÃO DEVIDA');
    expect(itens[1].textContent).toContain('Loja Exemplo · e3-carrinho');

    expect(itens[2].textContent).toContain('TROCA VENCENDO');
    expect(itens[2].textContent).toContain('Loja Exemplo');

    expect(itens[3].textContent).toContain('DIVERGÊNCIA');
    expect(itens[3].textContent).toContain('Loja Exemplo');

    expect(itens[4].textContent).toContain('VERSÃO DEFASADA');
    expect(itens[4].textContent).toContain('App Receitas');
  });

  it('exibe Diário de Campo em Terras em Névoa com NUNCA EM DIA e seus 3 diagnósticos (D08)', () => {
    render(<HojePage />);

    expect(screen.getByText('NUNCA EM DIA')).toBeTruthy();
    expect(screen.getAllByText(/estado desconhecido/i).length).toBeGreaterThanOrEqual(1);

    for (const diag of exemploOficial.diagnosticos) {
      expect(screen.getByText(diag.campo)).toBeTruthy();
      expect(screen.getByText(diag.motivo)).toBeTruthy();
    }

    // Na seção III, Diário de Campo tem núcleo null -> desconhecido, nunca em dia
    const diarios = screen.getAllByText('Diário de Campo');
    expect(diarios.length).toBeGreaterThanOrEqual(2);
    for (const el of diarios) {
      const blocoPai = el.closest('li, div');
      expect(blocoPai?.textContent).not.toContain('(em dia)');
    }
  });

  it('permite trocar seletores no Pergaminho de Abertura e copiar mensagem segura', async () => {
    const spyCopy = vi
      .spyOn(clipboardService, 'copyToClipboard')
      .mockResolvedValue(true);

    render(<HojePage />);

    const pre = screen.getByLabelText(/Pré-visualização da mensagem de abertura/i);
    expect(pre.textContent).toContain(
      'Para: coordenador (Antigravity, Gemini 3.8 Flash, esforço medium) · Etapa: e3-carrinho · CONVERSA NOVA'
    );
    expect(pre.textContent).toContain(
      'Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho'
    );

    // Troca projeto para app-receitas
    const selectProjeto = screen.getByLabelText('Projeto') as HTMLSelectElement;
    fireEvent.change(selectProjeto, { target: { value: 'app-receitas' } });

    expect(pre.textContent).toContain(
      'Worktree: ~/.sociedade/trabalho/app-receitas/r1-busca'
    );

    // Clica em Copiar mensagem
    const botaoCopiar = screen.getByRole('button', { name: /Copiar mensagem/i });
    fireEvent.click(botaoCopiar);

    expect(await screen.findByText(/Mensagem copiada!/i)).toBeTruthy();
    expect(spyCopy).toHaveBeenCalledTimes(1);

    spyCopy.mockRestore();
  });

  it('renderiza corretamente os estados carregando, vazio, erro e parcial (D05)', () => {
    const store = usePainelStore.getState();

    act(() => {
      store.definirEstado('carregando');
    });
    render(<HojePage />);
    expect(screen.getByText(/Reunindo o Conselho\.\.\./i)).toBeTruthy();

    act(() => {
      store.selecionarCenario('vazio');
    });
    expect(screen.getByText(/Conselho sem registros/i)).toBeTruthy();

    act(() => {
      store.selecionarCenario('invalido');
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Instantâneo inválido/i)).toBeTruthy();

    act(() => {
      store.resetar();
      store.definirEstado('parcial');
    });
    expect(screen.getByText(/Leitura parcial/i)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /I\. Espera pelo Conselho/i })
    ).toBeTruthy();
  });

  it('fonte_versao nula: nenhuma versão aparece "em dia" no Conselho (D08)', () => {
    const dados = JSON.parse(JSON.stringify(exemploOficial)) as Painel1;
    dados.pacote.fonte_versao = null;
    dados.diagnosticos.push({
      projeto: null,
      campo: 'pacote.fonte_versao',
      motivo: 'fonte ilegível (fictício)',
    });
    act(() => {
      usePainelStore.getState().carregarDadoBruto(dados);
    });
    render(<HojePage />);

    expect(screen.queryAllByText(/\(em dia\)/)).toHaveLength(0);
    expect(
      screen.getAllByText(/referência do pacote desconhecida/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it('cenário do revisor Barbárvore (A1.1): instalação com diagnóstico no campo não mostra (em dia) e mostra o motivo (D08)', () => {
    const dados = JSON.parse(JSON.stringify(exemploOficial)) as Painel1;
    dados.diagnosticos.push({
      projeto: null,
      campo: 'pacote.instalacoes[0].versao',
      motivo: 'versão não confirmada (fictício)',
    });
    act(() => {
      usePainelStore.getState().carregarDadoBruto(dados);
    });
    render(<HojePage />);

    // Item da instalação claude (índice 0)
    const elClaude = screen.getByText('claude');
    const liClaude = elClaude.closest('li');
    expect(liClaude).toBeTruthy();
    expect(liClaude?.textContent).not.toContain('(em dia)');
    expect(liClaude?.textContent).toContain('versão não confirmada (fictício)');
  });
});
