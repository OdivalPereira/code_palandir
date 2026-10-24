import type {
  ItemCardapio,
  NivelCardapio,
  PapelEscala,
  ProjetoPainel,
  SubagentesEscala,
  TipoPendencia,
} from '../contrato/painel1.types';
import { redactSecrets } from '@/features/prompt/usePromptGenerator';
import { copyToClipboard } from '@/services/clipboard';

/**
 * Ordem estrita de prioridade dos tipos de pendência na tela Hoje (seção 5.3 da arquitetura).
 */
export const ORDEM_TIPOS_PENDENCIA: readonly TipoPendencia[] = [
  'aprovar_ordem',
  'decidir',
  'revisao_devida',
  'passagem_a_levar',
  'troca_vencendo',
  'divergencia',
  'versao_defasada',
  'outro',
] as const;

export const ROTULOS_TIPO_PENDENCIA: Record<TipoPendencia, string> = {
  aprovar_ordem: 'APROVAR ORDEM',
  decidir: 'DECIDIR',
  revisao_devida: 'REVISÃO DEVIDA',
  passagem_a_levar: 'PASSAGEM A LEVAR',
  troca_vencendo: 'TROCA VENCENDO',
  divergencia: 'DIVERGÊNCIA',
  versao_defasada: 'VERSÃO DEFASADA',
  outro: 'OUTRO',
};

export const PAPEIS_DISPONIVEIS: readonly PapelEscala[] = [
  'coordenador',
  'arquiteto',
  'revisor',
  'aragorn',
  'elrond',
  'galadriel',
  'legolas',
  'jules',
] as const;

export interface PendenciaOrdenada {
  projetoId: string;
  projetoNome: string;
  tipo: TipoPendencia;
  rotuloTipo: string;
  texto: string;
  etapa: string | null;
}

/**
 * Extrai e ordena todas as pendências de todos os projetos segundo ORDEM_TIPOS_PENDENCIA,
 * preservando a ordem relativa de projetos/pendências em caso de empate.
 */
export function ordenarPendencias(projetos: ProjetoPainel[]): PendenciaOrdenada[] {
  const extraidas: Array<{ item: PendenciaOrdenada; indiceOriginal: number }> = [];
  let contador = 0;

  for (const projeto of projetos) {
    for (const pendencia of projeto.pendencias) {
      extraidas.push({
        indiceOriginal: contador++,
        item: {
          projetoId: projeto.id,
          projetoNome: projeto.nome,
          tipo: pendencia.tipo,
          rotuloTipo: ROTULOS_TIPO_PENDENCIA[pendencia.tipo] ?? 'OUTRO',
          texto: pendencia.texto,
          etapa: pendencia.etapa ?? null,
        },
      });
    }
  }

  extraidas.sort((a, b) => {
    const idxA = ORDEM_TIPOS_PENDENCIA.indexOf(a.item.tipo);
    const idxB = ORDEM_TIPOS_PENDENCIA.indexOf(b.item.tipo);
    const prioA = idxA === -1 ? ORDEM_TIPOS_PENDENCIA.length : idxA;
    const prioB = idxB === -1 ? ORDEM_TIPOS_PENDENCIA.length : idxB;

    if (prioA !== prioB) {
      return prioA - prioB;
    }
    return a.indiceOriginal - b.indiceOriginal;
  });

  return extraidas.map((e) => e.item);
}

export interface ParametrosMensagemAbertura {
  projetoId: string;
  etapaId: string;
  papel: PapelEscala | string;
  plataforma: string;
  modelo: string;
  esforco: string;
  subagentes?: SubagentesEscala;
}

/**
 * Formata o mapa de subagentes na ordem estrita do pacote 3.4.0: alta, moderada, simples.
 */
export function formatarSubagentes(subagentes?: SubagentesEscala): string {
  if (!subagentes) return '';
  const partes: string[] = [];
  const ordem: readonly (keyof SubagentesEscala)[] = ['alta', 'moderada', 'simples'];

  for (const nivel of ordem) {
    const modelo = subagentes[nivel]?.trim();
    if (modelo) {
      partes.push(`${nivel}=${modelo}`);
    }
  }

  return partes.join(',');
}

/**
 * Gera exatamente as 5 linhas do comando `sc.py abertura` (pacote 3.4.0, seção 5.3).
 */
export function gerarMensagemAbertura(params: ParametrosMensagemAbertura): string {
  const { projetoId, etapaId, papel, plataforma, modelo, esforco, subagentes } = params;
  const subagentesStr = formatarSubagentes(subagentes);

  const linha1 = `Para: ${papel} (${plataforma}, ${modelo}, esforço ${esforco}) · Etapa: ${etapaId} · CONVERSA NOVA`;
  const linha2 = `Worktree: ~/.sociedade/trabalho/${projetoId}/${etapaId}`;
  const linha3 = `Escala: papel=${papel}, plataforma=${plataforma}, modelo=${modelo}, esforço=${esforco}${
    subagentesStr ? `, subagentes: ${subagentesStr}` : ''
  }`;
  const linha4 = `Assumir: sc.py assumir ${papel} --etapa ${etapaId} --plataforma "${plataforma}" --modelo "${modelo}" --esforco "${esforco}"${
    subagentesStr ? ` --subagentes "${subagentesStr}"` : ''
  }`;
  const linha5 = `Ação: leia a ordem da etapa (sociedade/ordens/${etapaId}.md).`;

  return [linha1, linha2, linha3, linha4, linha5].join('\n');
}

/**
 * Aplica redactSecrets antes de exibir ou copiar para a área de transferência.
 */
export function prepararTextoParaCopia(texto: string): string {
  return redactSecrets(texto);
}

/**
 * Filtra segredos com redactSecrets e copia para a área de transferência usando copyToClipboard.
 */
export async function copiarMensagemSegura(
  texto: string
): Promise<{ textoFiltrado: string; copiado: boolean }> {
  const textoFiltrado = prepararTextoParaCopia(texto);
  const copiado = await copyToClipboard(textoFiltrado);
  return { textoFiltrado, copiado };
}

/**
 * Retorna a lista de plataformas únicas presentes no cardápio do instantâneo.
 */
export function obterPlataformasCardapio(cardapio: ItemCardapio[] = []): string[] {
  const vistas = new Set<string>();
  const plataformas: string[] = [];

  for (const item of cardapio) {
    if (item.plataforma && !vistas.has(item.plataforma)) {
      vistas.add(item.plataforma);
      plataformas.push(item.plataforma);
    }
  }

  return plataformas;
}

/**
 * Filtra as opções de modelo e esforço exclusivamente a partir do cardápio do instantâneo.
 */
export function obterOpcoesCardapio(
  cardapio: ItemCardapio[] = [],
  plataforma: string,
  nivel?: NivelCardapio
): ItemCardapio[] {
  return cardapio.filter(
    (item) => item.plataforma === plataforma && (nivel === undefined || item.nivel === nivel)
  );
}
