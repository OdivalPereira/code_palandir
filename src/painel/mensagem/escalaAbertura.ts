import type {
  ItemCardapio,
  NivelCardapio,
  PapelEscala,
  ProjetoPainel,
} from '../contrato/painel1.types';
import { gerarMensagemAbertura, obterOpcoesCardapio, obterPlataformasCardapio } from './geradorMensagem';

/**
 * Regras puras do Pergaminho de Abertura: tudo vem do instantâneo (projetos e cardápio).
 * Nada é inventado; o que falta bloqueia a cópia com um motivo legível.
 */

export const NIVEIS_SUBAGENTE: readonly NivelCardapio[] = ['alta', 'moderada', 'simples'] as const;

export type SubagentesSelecionados = Record<NivelCardapio, string | null>;

export interface SelecaoAbertura {
  projetoId: string | null;
  etapaId: string | null;
  papel: PapelEscala;
  plataforma: string | null;
  chaveEscala: string | null;
  incluirSubagentes: boolean;
  subagentes: SubagentesSelecionados;
}

export interface OpcoesAbertura {
  plataformas: string[];
  escala: ItemCardapio[];
  subagentes: Record<NivelCardapio, string[]>;
}

export interface ResultadoAbertura {
  selecao: SelecaoAbertura;
  opcoes: OpcoesAbertura;
  /** Motivos que bloqueiam a cópia; vazio quando a escala está completa. */
  bloqueios: string[];
  /** Motivo de os subagentes saírem da mensagem (opcionais no sc.py abertura). */
  avisoSubagentes: string | null;
  /** Mensagem de cinco linhas; null quando há bloqueio. */
  mensagem: string | null;
}

export const MOTIVO_SEM_PROJETO = 'Nenhum projeto coletado no instantâneo.';
export const MOTIVO_SEM_ETAPA = 'Nenhuma etapa coletada para este projeto.';
export const MOTIVO_CARDAPIO_VAZIO = 'Cardápio indisponível: o instantâneo não trouxe o cardápio.';

export function motivoCardapioSemPlataforma(plataforma: string): string {
  return `Cardápio indisponível para a plataforma ${plataforma}.`;
}

export function chaveOpcaoCardapio(item: ItemCardapio): string {
  return `${item.nivel}::${item.modelo}::${item.esforco}`;
}

/** Projeto padrão: `loja-exemplo` se existir, senão o primeiro; sem projetos, null. */
export function resolverProjetoPadrao(projetos: ProjetoPainel[]): string | null {
  const loja = projetos.find((p) => p.id === 'loja-exemplo');
  return loja?.id ?? projetos[0]?.id ?? null;
}

/** Etapa padrão do projeto; sem etapas coletadas, null (nunca um ID inventado). */
export function resolverEtapaPadrao(projeto?: ProjetoPainel | null): string | null {
  if (!projeto || projeto.etapas.length === 0) return null;
  const carrinho = projeto.etapas.find((e) => e.id === 'e3-carrinho');
  if (carrinho) return carrinho.id;
  const emAndamento = projeto.etapas.find((e) => e.estacao !== 'encerrada');
  if (emAndamento) return emAndamento.id;
  return projeto.etapas[projeto.etapas.length - 1].id;
}

/** Plataforma padrão só do cardápio: `Antigravity` se estiver nele, senão a primeira; vazio, null. */
export function resolverPlataformaPadrao(cardapio: ItemCardapio[] = []): string | null {
  const plataformas = obterPlataformasCardapio(cardapio);
  return plataformas.includes('Antigravity') ? 'Antigravity' : plataformas[0] ?? null;
}

/** Modelos únicos das linhas do cardápio com a plataforma e o nível pedidos. */
export function obterOpcoesSubagente(
  cardapio: ItemCardapio[] = [],
  plataforma: string | null,
  nivel: NivelCardapio
): string[] {
  if (!plataforma) return [];
  return Array.from(new Set(obterOpcoesCardapio(cardapio, plataforma, nivel).map((i) => i.modelo)));
}

function manterOuPrimeiro(atual: string | null, validas: string[]): string | null {
  return atual !== null && validas.includes(atual) ? atual : validas[0] ?? null;
}

/**
 * Revalida a seleção contra o instantâneo: cada escolha que deixou de ser válida passa
 * para a primeira opção válida (ou fica null quando não há nenhuma).
 */
export function normalizarSelecao(
  projetos: ProjetoPainel[],
  cardapio: ItemCardapio[] = [],
  bruta: SelecaoAbertura
): { selecao: SelecaoAbertura; opcoes: OpcoesAbertura } {
  const projetoId = projetos.some((p) => p.id === bruta.projetoId)
    ? bruta.projetoId
    : resolverProjetoPadrao(projetos);
  const projeto = projetos.find((p) => p.id === projetoId) ?? null;
  const etapas = projeto?.etapas.map((e) => e.id) ?? [];
  const etapaId =
    bruta.etapaId !== null && etapas.includes(bruta.etapaId)
      ? bruta.etapaId
      : resolverEtapaPadrao(projeto);

  const plataformas = obterPlataformasCardapio(cardapio);
  const plataforma =
    bruta.plataforma !== null && plataformas.includes(bruta.plataforma)
      ? bruta.plataforma
      : resolverPlataformaPadrao(cardapio);

  const escala = plataforma ? obterOpcoesCardapio(cardapio, plataforma) : [];
  const chaves = escala.map(chaveOpcaoCardapio);
  const moderada = escala.find((o) => o.nivel === 'moderada') ?? escala[0];
  const chaveEscala =
    bruta.chaveEscala !== null && chaves.includes(bruta.chaveEscala)
      ? bruta.chaveEscala
      : moderada
        ? chaveOpcaoCardapio(moderada)
        : null;

  const opcoesSub = {} as Record<NivelCardapio, string[]>;
  const subagentes = {} as SubagentesSelecionados;
  for (const nivel of NIVEIS_SUBAGENTE) {
    opcoesSub[nivel] = obterOpcoesSubagente(cardapio, plataforma, nivel);
    subagentes[nivel] = manterOuPrimeiro(bruta.subagentes[nivel], opcoesSub[nivel]);
  }

  return {
    selecao: { ...bruta, projetoId, etapaId, plataforma, chaveEscala, subagentes },
    opcoes: { plataformas, escala, subagentes: opcoesSub },
  };
}

/** Seleção inicial a partir do instantâneo. */
export function selecaoInicial(
  projetos: ProjetoPainel[],
  cardapio: ItemCardapio[] = []
): SelecaoAbertura {
  return normalizarSelecao(projetos, cardapio, {
    projetoId: null,
    etapaId: null,
    papel: 'coordenador',
    plataforma: null,
    chaveEscala: null,
    incluirSubagentes: true,
    subagentes: { alta: null, moderada: null, simples: null },
  }).selecao;
}

/**
 * Valida a seleção e monta a mensagem só quando a escala está completa e vem do instantâneo.
 * Para entradas válidas a saída é a mesma de `gerarMensagemAbertura` (teste-ouro da seção 5.3).
 */
export function montarAbertura(
  projetos: ProjetoPainel[],
  cardapio: ItemCardapio[] | undefined,
  bruta: SelecaoAbertura
): ResultadoAbertura {
  const linhas = cardapio ?? [];
  const { selecao, opcoes } = normalizarSelecao(projetos, linhas, bruta);
  const bloqueios: string[] = [];

  if (selecao.projetoId === null) bloqueios.push(MOTIVO_SEM_PROJETO);
  else if (selecao.etapaId === null) bloqueios.push(MOTIVO_SEM_ETAPA);

  if (linhas.length === 0 || selecao.plataforma === null) bloqueios.push(MOTIVO_CARDAPIO_VAZIO);
  else if (opcoes.escala.length === 0) bloqueios.push(motivoCardapioSemPlataforma(selecao.plataforma));

  const item = opcoes.escala.find((o) => chaveOpcaoCardapio(o) === selecao.chaveEscala);

  let avisoSubagentes: string | null = null;
  if (selecao.incluirSubagentes && selecao.plataforma !== null && opcoes.escala.length > 0) {
    const faltam = NIVEIS_SUBAGENTE.filter((n) => selecao.subagentes[n] === null);
    if (faltam.length > 0) {
      avisoSubagentes = `Subagentes fora da mensagem: o cardápio não tem opção de nível ${faltam.join(', ')} para ${selecao.plataforma}.`;
    }
  }

  if (bloqueios.length > 0 || !item || selecao.projetoId === null || selecao.etapaId === null) {
    return { selecao, opcoes, bloqueios, avisoSubagentes, mensagem: null };
  }

  const usarSubagentes = selecao.incluirSubagentes && avisoSubagentes === null;
  const mensagem = gerarMensagemAbertura({
    projetoId: selecao.projetoId,
    etapaId: selecao.etapaId,
    papel: selecao.papel,
    plataforma: selecao.plataforma as string,
    modelo: item.modelo,
    esforco: item.esforco,
    subagentes: usarSubagentes
      ? {
          alta: selecao.subagentes.alta as string,
          moderada: selecao.subagentes.moderada as string,
          simples: selecao.subagentes.simples as string,
        }
      : undefined,
  });

  return { selecao, opcoes, bloqueios, avisoSubagentes, mensagem };
}
