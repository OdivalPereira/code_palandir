import { describe, expect, it, vi } from 'vitest';
import { exemploOficial } from '../painel/fixtures/cenarios';
import type { ProjetoPainel, TipoPendencia } from '../painel/contrato/painel1.types';
import {
  copiarMensagemSegura,
  gerarMensagemAbertura,
  obterOpcoesCardapio,
  obterPlataformasCardapio,
  ORDEM_TIPOS_PENDENCIA,
  ordenarPendencias,
  prepararTextoParaCopia,
} from '../painel/mensagem/geradorMensagem';
import * as clipboardService from '@/services/clipboard';

const SAIDA_OURO_SECAO_5_3 = [
  'Para: coordenador (Antigravity, Gemini 3.8 Flash, esforço medium) · Etapa: e3-carrinho · CONVERSA NOVA',
  'Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho',
  'Escala: papel=coordenador, plataforma=Antigravity, modelo=Gemini 3.8 Flash, esforço=medium, subagentes: alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash',
  'Assumir: sc.py assumir coordenador --etapa e3-carrinho --plataforma "Antigravity" --modelo "Gemini 3.8 Flash" --esforco "medium" --subagentes "alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash"',
  'Ação: leia a ordem da etapa (sociedade/ordens/e3-carrinho.md).',
].join('\n');

describe('geradorMensagem — Teste-ouro e regras do Pergaminho de Abertura (F3)', () => {
  it('gera saída idêntica caractere por caractere ao teste-ouro da seção 5.3 da arquitetura', () => {
    const resultado = gerarMensagemAbertura({
      projetoId: 'loja-exemplo',
      etapaId: 'e3-carrinho',
      papel: 'coordenador',
      plataforma: 'Antigravity',
      modelo: 'Gemini 3.8 Flash',
      esforco: 'medium',
      subagentes: {
        alta: 'Gemini 4 Argon',
        moderada: 'Gemini 3.8 Flash',
        simples: 'Gemini 3.8 Flash',
      },
    });

    expect(resultado).toBe(SAIDA_OURO_SECAO_5_3);
    expect(resultado.split('\n')).toHaveLength(5);
  });

  it('gera a linha Worktree igual à do sc.py abertura 3.4.0 (~/.sociedade/trabalho/<projeto>/<etapa>)', () => {
    const resultado = gerarMensagemAbertura({
      projetoId: 'app-receitas',
      etapaId: 'r1-busca',
      papel: 'arquiteto',
      plataforma: 'Claude Code',
      modelo: 'Claude Opus 4.7',
      esforco: 'xhigh',
    });

    const linhas = resultado.split('\n');
    expect(linhas[1]).toBe('Worktree: ~/.sociedade/trabalho/app-receitas/r1-busca');
    expect(linhas[2]).toBe(
      'Escala: papel=arquiteto, plataforma=Claude Code, modelo=Claude Opus 4.7, esforço=xhigh'
    );
    expect(linhas[3]).toBe(
      'Assumir: sc.py assumir arquiteto --etapa r1-busca --plataforma "Claude Code" --modelo "Claude Opus 4.7" --esforco "xhigh"'
    );
  });

  it('aplica redactSecrets antes de copiar para a área de transferência', async () => {
    const spyCopy = vi
      .spyOn(clipboardService, 'copyToClipboard')
      .mockResolvedValue(true);

    const fakeGhp = ['gh', 'p_', 'a'.repeat(36)].join('');
    const fakeSk = ['sk-', 'proj-', 'b'.repeat(24)].join('');
    const fakeAi = ['AIza', 'Sy', 'c'.repeat(33)].join('');

    const textoComSegredos = [
      `Token GitHub: ${fakeGhp}`,
      `Chave OpenAI: ${fakeSk}`,
      `Chave Gemini: ${fakeAi}`,
    ].join('\n');

    const filtradoDireto = prepararTextoParaCopia(textoComSegredos);
    expect(filtradoDireto).toContain('ghp_REDACTED_PAT');
    expect(filtradoDireto).toContain('sk_REDACTED_KEY');
    expect(filtradoDireto).toContain('AIzaSy_REDACTED_KEY');
    expect(filtradoDireto).not.toContain(fakeGhp);

    const { textoFiltrado, copiado } = await copiarMensagemSegura(textoComSegredos);
    expect(copiado).toBe(true);
    expect(textoFiltrado).toBe(filtradoDireto);
    expect(spyCopy).toHaveBeenCalledWith(filtradoDireto);

    spyCopy.mockRestore();
  });

  it('ordena todos os 8 tipos de pendência na ordem estrita da seção 5.3', () => {
    const tiposEmbaralhados: TipoPendencia[] = [
      'outro',
      'versao_defasada',
      'divergencia',
      'troca_vencendo',
      'passagem_a_levar',
      'revisao_devida',
      'decidir',
      'aprovar_ordem',
    ];

    const projetoTeste: ProjetoPainel = {
      id: 'proj-ordem',
      nome: 'Projeto Ordem',
      pastas: [],
      nucleo: '3.4.0',
      etapas: [],
      pendencias: tiposEmbaralhados.map((tipo) => ({
        tipo,
        texto: `Texto para ${tipo}`,
        etapa: null,
      })),
    };

    const ordenadas = ordenarPendencias([projetoTeste]);
    expect(ordenadas.map((p) => p.tipo)).toEqual([...ORDEM_TIPOS_PENDENCIA]);

    // Confere também com os dados reais do exemploOficial
    const doExemplo = ordenarPendencias(exemploOficial.projetos);
    expect(doExemplo.map((p) => p.tipo)).toEqual([
      'aprovar_ordem',
      'revisao_devida',
      'troca_vencendo',
      'divergencia',
      'versao_defasada',
    ]);
    expect(doExemplo[0].projetoNome).toBe('App Receitas');
    expect(doExemplo[0].etapa).toBe('r1-busca');
  });

  it('extrai plataformas, modelos e esforços exclusivamente do cardápio do instantâneo', () => {
    const cardapio = exemploOficial.cardapio ?? [];
    const plataformas = obterPlataformasCardapio(cardapio);

    expect(plataformas).toEqual(['Claude Code', 'Codex', 'Antigravity']);

    const opcoesAntigravity = obterOpcoesCardapio(cardapio, 'Antigravity');
    expect(opcoesAntigravity).toHaveLength(3);
    expect(opcoesAntigravity.map((o) => `${o.nivel}:${o.modelo}:${o.esforco}`)).toEqual([
      'alta:Gemini 4 Argon:high',
      'moderada:Gemini 3.8 Flash:medium',
      'simples:Gemini 3.8 Flash:low',
    ]);

    const apenasModerada = obterOpcoesCardapio(cardapio, 'Antigravity', 'moderada');
    expect(apenasModerada).toHaveLength(1);
    expect(apenasModerada[0].modelo).toBe('Gemini 3.8 Flash');
    expect(apenasModerada[0].esforco).toBe('medium');
  });
});
