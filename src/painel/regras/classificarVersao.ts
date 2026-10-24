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
  /** Quantidade de diagnósticos do campo/projeto ou motivo do diagnóstico. */
  diagnosticos?: number | string | null;
  /** Motivo específico de diagnóstico do campo (se houver). */
  motivoDiagnostico?: string | null;
}

export interface ResultadoVersao {
  estado: EstadoVersao;
  /** Motivo legível; vazio só em `em_dia`. */
  motivo: string;
}

export function classificarVersao(e: EntradaVersao): ResultadoVersao {
  const diagCount = typeof e.diagnosticos === 'number' ? e.diagnosticos : 0;
  const diagTexto = typeof e.diagnosticos === 'string' ? e.diagnosticos : null;
  const motivoDiagEspecifico = e.motivoDiagnostico ?? diagTexto;
  const temDiag = diagCount > 0 || (motivoDiagEspecifico != null && motivoDiagEspecifico.length > 0);

  // 1º Precedência: Versão nula, fonte_versao nula ou diagnóstico do campo -> desconhecido
  if (e.versao == null) {
    return { estado: 'desconhecido', motivo: 'versão desconhecida' };
  }
  if (e.fonteVersao == null) {
    return {
      estado: 'desconhecido',
      motivo:
        e.alteracaoLocal === true
          ? 'referência do pacote desconhecida · alteração local'
          : 'referência do pacote desconhecida',
    };
  }
  if (temDiag) {
    const baseDiag =
      motivoDiagEspecifico ??
      `${diagCount} ${diagCount === 1 ? 'diagnóstico' : 'diagnósticos'}`;
    return {
      estado: 'desconhecido',
      motivo: e.alteracaoLocal === true ? `${baseDiag} · alteração local` : baseDiag,
    };
  }

  // 2º Precedência: Depois, alteração local ou versão diferente -> defasado
  if (e.alteracaoLocal === true) {
    return { estado: 'defasado', motivo: 'alteração local' };
  }
  if (e.versao !== e.fonteVersao) {
    return { estado: 'defasado', motivo: 'defasado' };
  }

  // 3º Precedência: Só então -> em_dia
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
