import { describe, expect, it } from 'vitest';
import { classificarVersao } from '../painel/regras/classificarVersao';

describe('classificarVersao (D08)', () => {
  const casos: Array<[string, Parameters<typeof classificarVersao>[0], string]> = [];
  for (const versao of [null, '3.2.0', '3.1.0']) {
    for (const fonte of [null, '3.2.0']) {
      for (const local of [false, true]) {
        for (const diag of [0, 2]) {
          let esperado: string;
          if (versao === null) esperado = 'desconhecido';
          else if (local) esperado = 'defasado';
          else if (fonte === null) esperado = 'desconhecido';
          else if (versao !== fonte) esperado = 'defasado';
          else if (diag > 0) esperado = 'desconhecido';
          else esperado = 'em_dia';
          casos.push([
            `versao=${versao} fonte=${fonte} local=${local} diag=${diag}`,
            { versao, fonteVersao: fonte, alteracaoLocal: local, diagnosticos: diag },
            esperado,
          ]);
        }
      }
    }
  }

  it.each(casos)('%s', (_n, entrada, esperado) => {
    expect(classificarVersao(entrada).estado).toBe(esperado);
  });

  it('em_dia só com tudo conhecido, igual, sem alteração e sem diagnóstico', () => {
    const em = casos.filter(([, , e]) => e === 'em_dia');
    expect(em).toHaveLength(1);
  });

  it('fonte nula explica o motivo e nunca é em_dia', () => {
    const r = classificarVersao({ versao: '3.2.0', fonteVersao: null });
    expect(r.estado).toBe('desconhecido');
    expect(r.motivo).toMatch(/referência do pacote desconhecida/);
  });

  it('campos ausentes (undefined) são tratados como desconhecidos', () => {
    expect(classificarVersao({ versao: undefined, fonteVersao: '1' }).estado).toBe('desconhecido');
    expect(classificarVersao({ versao: '1', fonteVersao: undefined }).estado).toBe('desconhecido');
  });
});
