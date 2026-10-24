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

/**
 * Seleção bruta: null quer dizer "sem escolha ainda" (vale o padrão do instantâneo);
 * um valor quer dizer escolha que existia e que, se sumir do instantâneo, bloqueia a cópia.
 */
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

/** Escolhas que existiam e sumiram do instantâneo novo (não trocam em silêncio). */
export interface EscolhasAusentes {
  projeto: string | null;
  etapa: string | null;
  plataforma: string | null;
  escala: string | null;
}

export interface ResultadoAbertura {
  selecao: SelecaoAbertura;
  opcoes: OpcoesAbertura;
  ausentes: EscolhasAusentes;
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
  return `Cardápio indisponível para a plataforma ${plataforma}: ela não está mais no cardápio; escolha outra.`;
}

export function motivoProjetoAusente(projetoId: string): string {
  return `O projeto ${projetoId} não está mais no instantâneo; escolha outro.`;
}

export function motivoEtapaAusente(etapaId: string): string {
  return `A etapa ${etapaId} não está mais no instantâneo; escolha outra.`;
}

export function motivoEscalaAusente(chave: string, plataforma: string): string {
  const [nivel, modelo, esforco] = chave.split('::');
  return `A escala ${nivel}: ${modelo} · esforço ${esforco} não está mais no cardápio de ${plataforma}; escolha outra.`;
}

/*
 * A mensagem de abertura é colada num agente que executa a linha `Assumir: sc.py assumir ...`.
 * Ids e nomes vêm do instantâneo (o coletor lê nomes de pasta e de repositório), então um valor
 * com aspas, $, crase, ; ou quebra de linha viraria comando. Esses valores bloqueiam a mensagem.
 */
const ID_SEGURO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TEXTO_INSEGURO = /["$`\\\r\n;|&<>]/;

function mostrar(valor: string): string {
  const curto = valor.length > 40 ? `${valor.slice(0, 40)}…` : valor;
  return JSON.stringify(curto);
}

export function motivoIdInseguro(campo: string, valor: string): string {
  return `O id de ${campo} ${mostrar(valor)} não é seguro para a linha Assumir (só letras, números, ponto, hífen e sublinhado; sem ".."); corrija na origem.`;
}

export function motivoTextoInseguro(campo: string, valor: string): string {
  return `O valor de ${campo} ${mostrar(valor)} tem caractere que o terminal interpretaria (aspas, $, crase, barra invertida, ;, |, &, <, > ou quebra de linha); corrija no cardápio.`;
}

/** Motivos de bloqueio para valores que não podem ir à linha `Assumir:`. */
export function motivosValoresInseguros(v: {
  projetoId: string;
  etapaId: string;
  plataforma: string;
  modelo: string;
  esforco: string;
  subagentes?: Partial<Record<NivelCardapio, string>>;
}): string[] {
  const motivos: string[] = [];
  const id = (campo: string, valor: string) => {
    if (!ID_SEGURO.test(valor) || valor.includes('..')) motivos.push(motivoIdInseguro(campo, valor));
  };
  const texto = (campo: string, valor: string, extra?: RegExp) => {
    if (TEXTO_INSEGURO.test(valor) || (extra && extra.test(valor))) {
      motivos.push(motivoTextoInseguro(campo, valor));
    }
  };
  id('projeto', v.projetoId);
  id('etapa', v.etapaId);
  texto('plataforma', v.plataforma);
  texto('modelo', v.modelo);
  texto('esforço', v.esforco);
  for (const nivel of NIVEIS_SUBAGENTE) {
    const modelo = v.subagentes?.[nivel];
    // "," e "=" separam os níveis em --subagentes "alta=X,moderada=Y"
    if (modelo) texto(`subagente (${nivel})`, modelo, /[,=]/);
  }
  return motivos;
}

export function chaveOpcaoCardapio(item: ItemCardapio): string {
  return `${item.nivel}::${item.modelo}::${item.esforco}`;
}

/** Linha com plataforma, modelo ou esforço vazio (ou só espaços) conta como ausente. */
export function linhaCardapioValida(item: ItemCardapio): boolean {
  return [item.plataforma, item.modelo, item.esforco].every(
    (v) => typeof v === 'string' && v.trim() !== ''
  );
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
  const plataformas = obterPlataformasCardapio(cardapio.filter(linhaCardapioValida));
  return plataformas.includes('Antigravity') ? 'Antigravity' : plataformas[0] ?? null;
}

/** Modelos únicos das linhas do cardápio com a plataforma e o nível pedidos. */
export function obterOpcoesSubagente(
  cardapio: ItemCardapio[] = [],
  plataforma: string | null,
  nivel: NivelCardapio
): string[] {
  if (!plataforma) return [];
  const linhas = obterOpcoesCardapio(cardapio.filter(linhaCardapioValida), plataforma, nivel);
  return Array.from(new Set(linhas.map((i) => i.modelo)));
}

function manterOuPrimeiro(atual: string | null, validas: string[]): string | null {
  return atual !== null && validas.includes(atual) ? atual : validas[0] ?? null;
}

/**
 * Resolve a seleção contra o instantâneo. Sem escolha (null), usa o padrão do instantâneo.
 * Escolha de projeto, etapa, plataforma ou escala que sumiu fica como está e vai para
 * `ausentes` (bloqueia a cópia). Subagentes, opcionais, passam para a primeira opção válida.
 */
export function normalizarSelecao(
  projetos: ProjetoPainel[],
  cardapio: ItemCardapio[] = [],
  bruta: SelecaoAbertura
): { selecao: SelecaoAbertura; opcoes: OpcoesAbertura; ausentes: EscolhasAusentes } {
  const linhas = cardapio.filter(linhaCardapioValida);
  const ausentes: EscolhasAusentes = { projeto: null, etapa: null, plataforma: null, escala: null };

  const projetoId = bruta.projetoId ?? resolverProjetoPadrao(projetos);
  const projeto = projetos.find((p) => p.id === projetoId) ?? null;
  if (projetoId !== null && !projeto && projetos.length > 0) ausentes.projeto = projetoId;

  const etapaId = bruta.etapaId ?? resolverEtapaPadrao(projeto);
  if (projeto && etapaId !== null && !projeto.etapas.some((e) => e.id === etapaId)) {
    ausentes.etapa = etapaId;
  }

  const plataformas = obterPlataformasCardapio(linhas);
  const plataforma = bruta.plataforma ?? resolverPlataformaPadrao(linhas);
  const plataformaValida = plataforma !== null && plataformas.includes(plataforma);
  if (plataforma !== null && !plataformaValida && linhas.length > 0) ausentes.plataforma = plataforma;

  const escala = plataformaValida ? obterOpcoesCardapio(linhas, plataforma as string) : [];
  const moderada = escala.find((o) => o.nivel === 'moderada') ?? escala[0];
  const chaveEscala = bruta.chaveEscala ?? (moderada ? chaveOpcaoCardapio(moderada) : null);
  if (chaveEscala !== null && escala.length > 0 && !escala.some((o) => chaveOpcaoCardapio(o) === chaveEscala)) {
    ausentes.escala = chaveEscala;
  }

  const opcoesSub = {} as Record<NivelCardapio, string[]>;
  const subagentes = {} as SubagentesSelecionados;
  for (const nivel of NIVEIS_SUBAGENTE) {
    opcoesSub[nivel] = plataformaValida ? obterOpcoesSubagente(linhas, plataforma, nivel) : [];
    subagentes[nivel] = manterOuPrimeiro(bruta.subagentes[nivel], opcoesSub[nivel]);
  }

  return {
    selecao: { ...bruta, projetoId, etapaId, plataforma, chaveEscala, subagentes },
    opcoes: { plataformas, escala, subagentes: opcoesSub },
    ausentes,
  };
}

/** Seleção inicial: nenhuma escolha ainda; o padrão vem do instantâneo a cada render. */
export function selecaoInicial(): SelecaoAbertura {
  return {
    projetoId: null,
    etapaId: null,
    papel: 'coordenador',
    plataforma: null,
    chaveEscala: null,
    incluirSubagentes: true,
    subagentes: { alta: null, moderada: null, simples: null },
  };
}

/**
 * O usuário troca a plataforma: escala e subagentes que deixaram de valer voltam a
 * "sem escolha" (passam para o padrão da nova plataforma).
 */
export function escolherPlataforma(
  cardapio: ItemCardapio[] = [],
  bruta: SelecaoAbertura,
  plataforma: string
): SelecaoAbertura {
  const linhas = cardapio.filter(linhaCardapioValida);
  const chaves = obterOpcoesCardapio(linhas, plataforma).map(chaveOpcaoCardapio);
  const subagentes = {} as SubagentesSelecionados;
  for (const nivel of NIVEIS_SUBAGENTE) {
    const atual = bruta.subagentes[nivel];
    subagentes[nivel] =
      atual !== null && obterOpcoesSubagente(linhas, plataforma, nivel).includes(atual) ? atual : null;
  }
  const chaveEscala = bruta.chaveEscala !== null && chaves.includes(bruta.chaveEscala) ? bruta.chaveEscala : null;
  return { ...bruta, plataforma, chaveEscala, subagentes };
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
  const linhas = (cardapio ?? []).filter(linhaCardapioValida);
  const { selecao, opcoes, ausentes } = normalizarSelecao(projetos, linhas, bruta);
  const bloqueios: string[] = [];

  if (projetos.length === 0 || selecao.projetoId === null) bloqueios.push(MOTIVO_SEM_PROJETO);
  else if (ausentes.projeto) bloqueios.push(motivoProjetoAusente(ausentes.projeto));
  else if (ausentes.etapa) bloqueios.push(motivoEtapaAusente(ausentes.etapa));
  else if (selecao.etapaId === null) bloqueios.push(MOTIVO_SEM_ETAPA);

  if (linhas.length === 0 || selecao.plataforma === null) bloqueios.push(MOTIVO_CARDAPIO_VAZIO);
  else if (ausentes.plataforma || opcoes.escala.length === 0) {
    bloqueios.push(motivoCardapioSemPlataforma(selecao.plataforma));
  } else if (ausentes.escala) bloqueios.push(motivoEscalaAusente(ausentes.escala, selecao.plataforma));

  const item = opcoes.escala.find((o) => chaveOpcaoCardapio(o) === selecao.chaveEscala);

  let avisoSubagentes: string | null = null;
  if (selecao.incluirSubagentes && opcoes.escala.length > 0) {
    const faltam = NIVEIS_SUBAGENTE.filter((n) => selecao.subagentes[n] === null);
    if (faltam.length > 0) {
      avisoSubagentes = `Subagentes fora da mensagem: o cardápio não tem opção de nível ${faltam.join(', ')} para ${selecao.plataforma}.`;
    }
  }

  if (bloqueios.length > 0 || !item || selecao.projetoId === null || selecao.etapaId === null) {
    return { selecao, opcoes, ausentes, bloqueios, avisoSubagentes, mensagem: null };
  }

  const usarSubagentes = selecao.incluirSubagentes && avisoSubagentes === null;
  const parametros = {
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
  };

  const inseguros = motivosValoresInseguros(parametros);
  if (inseguros.length > 0) {
    return { selecao, opcoes, ausentes, bloqueios: inseguros, avisoSubagentes, mensagem: null };
  }

  const mensagem = gerarMensagemAbertura(parametros);

  return { selecao, opcoes, ausentes, bloqueios, avisoSubagentes, mensagem };
}
