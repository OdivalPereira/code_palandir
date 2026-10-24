import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PainelShell } from '../app/PainelShell';
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
