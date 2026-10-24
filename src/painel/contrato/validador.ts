import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from './painel-1.schema.json';
import type { Painel1 } from './painel1.types';

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile<Painel1>(schema);

export type ResultadoValidacao =
  | { valido: true; dados: Painel1; erros: [] }
  | { valido: false; dados: null; erros: string[] };

/**
 * Valida um dado contra o esquema painel/1 utilizando Ajv 2020.
 * Preserva estritamente campos null (nunca altera dados recebidos).
 */
export function validarPainel1(dado: unknown): ResultadoValidacao {
  if (validate(dado)) {
    return {
      valido: true,
      dados: dado as Painel1,
      erros: [],
    };
  }

  const erros: string[] = (validate.errors || []).map((err) => {
    const caminho = err.instancePath ? err.instancePath : 'raiz';
    return `${caminho}: ${err.message || 'valor inválido'}`;
  });

  return {
    valido: false,
    dados: null,
    erros,
  };
}
