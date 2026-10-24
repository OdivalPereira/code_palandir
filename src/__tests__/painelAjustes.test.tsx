import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PainelShell } from '../app/PainelShell';
import { ProjetosPage } from '../painel/projetos/ProjetosPage';
import { formatarColetadoEm, pluralizar } from '../painel/formatacao';
import { exemploOficial } from '../painel/fixtures/cenarios';
import { usePainelStore } from '../stores/painelStore';

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
