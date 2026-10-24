import { describe, expect, it } from 'vitest';
import { classificarVersao, type EntradaVersao, type EstadoVersao } from '../painel/regras/classificarVersao';

describe('classificarVersao (D08)', () => {
  type CasoVersao = {
    nome: string;
    entrada: EntradaVersao;
    esperado: EstadoVersao;
  };

  // Tabela com todas as 24 combinações com resultado esperado escrito por extenso
  const casos: CasoVersao[] = [
    // 1. versao === null (8 casos: sempre desconhecido)
    { nome: 'versao=null fonte=null local=false diag=0', entrada: { versao: null, fonteVersao: null, alteracaoLocal: false, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=null local=false diag=2', entrada: { versao: null, fonteVersao: null, alteracaoLocal: false, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=null local=true diag=0', entrada: { versao: null, fonteVersao: null, alteracaoLocal: true, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=null local=true diag=2', entrada: { versao: null, fonteVersao: null, alteracaoLocal: true, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=3.2.0 local=false diag=0', entrada: { versao: null, fonteVersao: '3.2.0', alteracaoLocal: false, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=3.2.0 local=false diag=2', entrada: { versao: null, fonteVersao: '3.2.0', alteracaoLocal: false, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=3.2.0 local=true diag=0', entrada: { versao: null, fonteVersao: '3.2.0', alteracaoLocal: true, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=null fonte=3.2.0 local=true diag=2', entrada: { versao: null, fonteVersao: '3.2.0', alteracaoLocal: true, diagnosticos: 2 }, esperado: 'desconhecido' },

    // 2. versao === '3.2.0' com fonteVersao === null (4 casos: sempre desconhecido, incluindo fonteVersao: null com alteracaoLocal: true)
    { nome: 'versao=3.2.0 fonte=null local=false diag=0', entrada: { versao: '3.2.0', fonteVersao: null, alteracaoLocal: false, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=3.2.0 fonte=null local=false diag=2', entrada: { versao: '3.2.0', fonteVersao: null, alteracaoLocal: false, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=3.2.0 fonte=null local=true diag=0', entrada: { versao: '3.2.0', fonteVersao: null, alteracaoLocal: true, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=3.2.0 fonte=null local=true diag=2', entrada: { versao: '3.2.0', fonteVersao: null, alteracaoLocal: true, diagnosticos: 2 }, esperado: 'desconhecido' },

    // 3. versao === '3.2.0' com fonteVersao === '3.2.0' (versão igual à fonte; cobre diagnóstico com versão igual)
    { nome: 'versao=3.2.0 fonte=3.2.0 local=false diag=0', entrada: { versao: '3.2.0', fonteVersao: '3.2.0', alteracaoLocal: false, diagnosticos: 0 }, esperado: 'em_dia' },
    { nome: 'versao=3.2.0 fonte=3.2.0 local=false diag=2', entrada: { versao: '3.2.0', fonteVersao: '3.2.0', alteracaoLocal: false, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=3.2.0 fonte=3.2.0 local=true diag=0', entrada: { versao: '3.2.0', fonteVersao: '3.2.0', alteracaoLocal: true, diagnosticos: 0 }, esperado: 'defasado' },
    { nome: 'versao=3.2.0 fonte=3.2.0 local=true diag=2', entrada: { versao: '3.2.0', fonteVersao: '3.2.0', alteracaoLocal: true, diagnosticos: 2 }, esperado: 'desconhecido' },

    // 4. versao === '3.1.0' com fonteVersao === null (4 casos: sempre desconhecido)
    { nome: 'versao=3.1.0 fonte=null local=false diag=0', entrada: { versao: '3.1.0', fonteVersao: null, alteracaoLocal: false, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=3.1.0 fonte=null local=false diag=2', entrada: { versao: '3.1.0', fonteVersao: null, alteracaoLocal: false, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=3.1.0 fonte=null local=true diag=0', entrada: { versao: '3.1.0', fonteVersao: null, alteracaoLocal: true, diagnosticos: 0 }, esperado: 'desconhecido' },
    { nome: 'versao=3.1.0 fonte=null local=true diag=2', entrada: { versao: '3.1.0', fonteVersao: null, alteracaoLocal: true, diagnosticos: 2 }, esperado: 'desconhecido' },

    // 5. versao === '3.1.0' com fonteVersao === '3.2.0' (versão diferente da fonte; cobre diagnóstico com versão diferente)
    { nome: 'versao=3.1.0 fonte=3.2.0 local=false diag=0', entrada: { versao: '3.1.0', fonteVersao: '3.2.0', alteracaoLocal: false, diagnosticos: 0 }, esperado: 'defasado' },
    { nome: 'versao=3.1.0 fonte=3.2.0 local=false diag=2', entrada: { versao: '3.1.0', fonteVersao: '3.2.0', alteracaoLocal: false, diagnosticos: 2 }, esperado: 'desconhecido' },
    { nome: 'versao=3.1.0 fonte=3.2.0 local=true diag=0', entrada: { versao: '3.1.0', fonteVersao: '3.2.0', alteracaoLocal: true, diagnosticos: 0 }, esperado: 'defasado' },
    { nome: 'versao=3.1.0 fonte=3.2.0 local=true diag=2', entrada: { versao: '3.1.0', fonteVersao: '3.2.0', alteracaoLocal: true, diagnosticos: 2 }, esperado: 'desconhecido' },
  ];

  it.each(casos)('$nome -> $esperado', ({ entrada, esperado }) => {
    expect(classificarVersao(entrada).estado).toBe(esperado);
  });

  it('em_dia só com tudo conhecido, igual, sem alteração e sem diagnóstico', () => {
    const em = casos.filter((c) => c.esperado === 'em_dia');
    expect(em).toHaveLength(1);
  });

  it('fonte nula explica o motivo e nunca é em_dia', () => {
    const r = classificarVersao({ versao: '3.2.0', fonteVersao: null });
    expect(r.estado).toBe('desconhecido');
    expect(r.motivo).toMatch(/referência do pacote desconhecida/);
  });

  it('A1.2: fonteVersao nula com alteracaoLocal=true continua desconhecido e indica ambos no motivo', () => {
    const r = classificarVersao({
      versao: '3.2.0',
      fonteVersao: null,
      alteracaoLocal: true,
    });
    expect(r.estado).toBe('desconhecido');
    expect(r.motivo).toBe('referência do pacote desconhecida · alteração local');
  });

  it('A1.1: diagnóstico com versão igual é desconhecido e exibe o motivo', () => {
    const r = classificarVersao({
      versao: '3.2.0',
      fonteVersao: '3.2.0',
      alteracaoLocal: false,
      diagnosticos: 1,
      motivoDiagnostico: 'versão não confirmada (fictício)',
    });
    expect(r.estado).toBe('desconhecido');
    expect(r.motivo).toBe('versão não confirmada (fictício)');
  });

  it('diagnóstico com versão diferente é desconhecido (diagnóstico vence defasado)', () => {
    const r = classificarVersao({
      versao: '3.1.0',
      fonteVersao: '3.2.0',
      alteracaoLocal: false,
      diagnosticos: 1,
      motivoDiagnostico: 'divergência de coleta',
    });
    expect(r.estado).toBe('desconhecido');
    expect(r.motivo).toBe('divergência de coleta');
  });

  it('campos ausentes (undefined) são tratados como desconhecidos', () => {
    expect(classificarVersao({ versao: undefined, fonteVersao: '1' }).estado).toBe('desconhecido');
    expect(classificarVersao({ versao: '1', fonteVersao: undefined }).estado).toBe('desconhecido');
  });
});
