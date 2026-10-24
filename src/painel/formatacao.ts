/**
 * Formatação de valores do instantâneo para exibição.
 * Valor ilegível vira "desconhecido" (D08); nada é inventado (D10).
 */

const dois = (n: number) => String(n).padStart(2, '0');

/** "2026-10-23T15:00:00Z" → "23/10 15:00Z" (sempre em UTC, como o coletor grava). */
export function formatarColetadoEm(iso: string | null | undefined): string {
  if (!iso) return 'data desconhecida';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return 'data desconhecida';
  return `${dois(data.getUTCDate())}/${dois(data.getUTCMonth() + 1)} ${dois(
    data.getUTCHours()
  )}:${dois(data.getUTCMinutes())}Z`;
}

/** Concordância simples: 1 → singular; 0 ou mais de 1 → plural. */
export function pluralizar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
