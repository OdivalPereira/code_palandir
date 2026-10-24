/**
 * Regra única de versão (D08, "desconhecido ≠ vazio").
 * Instalações e núcleos usam esta função; as telas não repetem a regra.
 * Ausência de referência nunca vira confirmação positiva.
 */
export type EstadoVersao = 'em_dia' | 'defasado' | 'desconhecido';

export interface EntradaVersao {
  versao: string | null | undefined;
  fonteVersao: string | null | undefined;
  alteracaoLocal?: boolean | null;
  /** Quantidade de diagnósticos do campo/projeto. */
  diagnosticos?: number;
}

export interface ResultadoVersao {
  estado: EstadoVersao;
  /** Motivo legível; vazio só em `em_dia`. */
  motivo: string;
}

export function classificarVersao(e: EntradaVersao): ResultadoVersao {
  const diag = e.diagnosticos ?? 0;
  if (e.versao == null) {
    return { estado: 'desconhecido', motivo: 'versão desconhecida' };
  }
  if (e.alteracaoLocal === true) {
    return { estado: 'defasado', motivo: 'alteração local' };
  }
  if (e.fonteVersao == null) {
    return { estado: 'desconhecido', motivo: 'referência do pacote desconhecida' };
  }
  if (e.versao !== e.fonteVersao) {
    return { estado: 'defasado', motivo: 'defasado' };
  }
  if (diag > 0) {
    return {
      estado: 'desconhecido',
      motivo: `${diag} ${diag === 1 ? 'diagnóstico' : 'diagnósticos'}`,
    };
  }
  return { estado: 'em_dia', motivo: '' };
}

/** Rótulo do selo: versão + motivo/estado, sempre em texto. */
export function rotuloVersao(
  versao: string | null | undefined,
  r: ResultadoVersao
): string {
  if (versao == null) return 'desconhecido (versão desconhecida)';
  if (r.estado === 'em_dia') return `${versao} (em dia)`;
  return `${versao} (${r.motivo})`;
}
