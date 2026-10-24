import type { Painel1 } from '../contrato/painel1.types';
import { exemploOficialLiteral } from './exemploOficial';

/**
 * Exemplo oficial congelado da Sociedade do Código.
 */
export const exemploOficial: Painel1 = exemploOficialLiteral;

/**
 * Cenário válido baseado no exemplo oficial.
 */
export const cenarioValido: Painel1 = {
  ...exemploOficial,
};

/**
 * Cenário vazio: instantâneo válido sem projetos e sem diagnósticos.
 */
export const cenarioVazio: Painel1 = {
  esquema: 'painel/1',
  coletado_em: '2026-10-23T15:00:00Z',
  maquina: 'vazio',
  pacote: {
    fonte_versao: '3.4.0',
    instalacoes: [],
  },
  cardapio: [],
  projetos: [],
  diagnosticos: [],
};

/**
 * Cenário só desconhecidos: instantâneo válido com campos anuláveis definidos como null
 * acompanhados de diagnósticos justificando cada desconhecimento.
 */
export const cenarioSoDesconhecidos: Painel1 = {
  esquema: 'painel/1',
  coletado_em: '2026-10-23T15:00:00Z',
  maquina: 'desconhecido',
  pacote: {
    fonte_versao: null,
    instalacoes: [
      {
        ferramenta: 'outra',
        versao: null,
        origem: null,
        alteracao_local: null,
      },
    ],
  },
  cardapio: [],
  projetos: [
    {
      id: 'projeto-desconhecido',
      nome: 'Projeto Desconhecido',
      envio_ligado: false,
      pastas: [
        {
          ferramenta: 'nenhuma',
          caminho: '/tmp/desconhecido',
          tipo: 'canonica',
          ramo: null,
          sha: null,
          limpa: null,
        },
      ],
      nucleo: null,
      formato_registro: 'desconhecido',
      etapas: [
        {
          id: 'etapa-desconhecida',
          estacao: 'desconhecida',
          decisao: null,
          grau: null,
          interacoes: [
            {
              escala: {
                papel: 'coordenador',
                plataforma: 'Antigravity',
                fornecedor: 'Google',
                modelo: 'Gemini 3.8 Flash',
                esforco: 'medium',
              },
              inicio: '2026-10-23T12:00:00Z',
              modelo_no_log: null,
              avisos: ['log em processamento'],
            },
          ],
          passagens: [],
        },
      ],
      pendencias: [
        {
          tipo: 'outro',
          texto: 'Pendência geral de migração',
          etapa: null,
        },
      ],
      ajustes_metodo: [],
    },
  ],
  diagnosticos: [
    { projeto: null, campo: 'pacote.fonte_versao', motivo: 'fonte sem versão detectável' },
    { projeto: 'projeto-desconhecido', campo: 'nucleo', motivo: 'núcleo ausente' },
    { projeto: 'projeto-desconhecido', campo: 'pastas[0].ramo', motivo: 'ramo não detectado' },
    { projeto: 'projeto-desconhecido', campo: 'pastas[0].sha', motivo: 'commit não identificado' },
    { projeto: 'projeto-desconhecido', campo: 'pastas[0].limpa', motivo: 'árvore de trabalho não conferida' },
    { projeto: 'projeto-desconhecido', campo: 'etapas[0].decisao', motivo: 'decisão ainda não tomada' },
    { projeto: 'projeto-desconhecido', campo: 'etapas[0].grau', motivo: 'grau ainda não atribuído' },
    { projeto: 'projeto-desconhecido', campo: 'etapas[0].interacoes[0].modelo_no_log', motivo: 'modelo ausente no log' },
    { projeto: 'projeto-desconhecido', campo: 'pendencias[0].etapa', motivo: 'pendência sem etapa associada' },
  ],
};

/**
 * Cenário limites: instantâneo válido exercitando valores máximos de comprimento permitidos.
 */
export const cenarioLimites: Painel1 = {
  esquema: 'painel/1',
  coletado_em: '2026-10-23T23:59:59Z',
  maquina: 'M'.repeat(64),
  pacote: {
    fonte_versao: 'V'.repeat(32),
    instalacoes: [
      {
        ferramenta: 'antigravity',
        versao: 'V'.repeat(32),
        origem: 'O'.repeat(80),
        alteracao_local: true,
      },
    ],
  },
  cardapio: [
    {
      plataforma: 'P'.repeat(40),
      fornecedor: 'F'.repeat(40),
      nivel: 'alta',
      modelo: 'M'.repeat(60),
      esforco: 'E'.repeat(20),
    },
  ],
  projetos: [
    {
      id: 'P'.repeat(80),
      nome: 'N'.repeat(80),
      envio_ligado: true,
      pastas: [
        {
          ferramenta: 'antigravity',
          caminho: '/' + 'C'.repeat(239),
          tipo: 'worktree',
          ramo: 'R'.repeat(120),
          sha: 'abcdef0123456789abcdef0123456789abcdef01', // 40 chars hex
          limpa: true,
        },
      ],
      nucleo: 'N'.repeat(32),
      formato_registro: '2.1.0-cadeia',
      etapas: [
        {
          id: 'E'.repeat(40),
          estacao: 'execucao',
          decisao: 'D'.repeat(40),
          grau: 'A',
          interacoes: [
            {
              escala: {
                papel: 'coordenador',
                plataforma: 'P'.repeat(40),
                fornecedor: 'F'.repeat(40),
                modelo: 'M'.repeat(60),
                esforco: 'E'.repeat(20),
                subagentes: {
                  simples: 'S'.repeat(60),
                  moderada: 'M'.repeat(60),
                  alta: 'A'.repeat(60),
                },
              },
              inicio: '2026-10-23T20:00:00Z',
              modelo_no_log: 'M'.repeat(60),
              avisos: ['A'.repeat(120)],
            },
          ],
          passagens: [
            {
              de: 'D'.repeat(40),
              para: 'P'.repeat(40),
              quando: '2026-10-23T21:00:00Z',
              bloco: 'B'.repeat(2048),
            },
          ],
        },
      ],
      pendencias: [
        {
          tipo: 'decidir',
          texto: 'T'.repeat(200),
          etapa: 'E'.repeat(40),
        },
      ],
      ajustes_metodo: [
        {
          id: 'A'.repeat(40),
          estado: 'em_avaliacao',
          resumo: 'R'.repeat(200),
        },
      ],
    },
  ],
  diagnosticos: [
    {
      projeto: 'P'.repeat(80),
      campo: 'C'.repeat(80),
      motivo: 'M'.repeat(200),
    },
  ],
};

/**
 * Cenário parcial: instantâneo válido com projetos e diagnósticos indicando leitura parcial.
 */
export const cenarioParcial: Painel1 = {
  ...exemploOficial,
  diagnosticos: [
    ...exemploOficial.diagnosticos,
    {
      projeto: 'loja-exemplo',
      campo: 'etapas',
      motivo: 'leitura parcial: etapas anteriores arquivadas em armazenamento frio',
    },
  ],
};

/**
 * Cenário inválido: objeto arbitrário que falha contra a validação do esquema Ajv 2020.
 */
export const cenarioInvalido: unknown = {
  esquema: 'painel/999',
  coletado_em: 'data-invalida',
  maquina: 'M'.repeat(100),
  pacote: {
    fonte_versao: 12345, // tipo inválido
    instalacoes: 'nao-e-array',
  },
  projetos: [
    {
      id: 'invalido',
      nome: 'Inválido',
      pastas: [
        {
          ferramenta: 'inexistente',
          caminho: '/caminho',
          tipo: 'tipo-invalido',
          sha: 'NAO_HEX_TOTALMENTE_INVALIDO',
        },
      ],
    },
  ],
  diagnosticos: 'nao-e-array',
  campo_intruso_nao_permitido: true,
};
