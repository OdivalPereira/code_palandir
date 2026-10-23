import type { Painel1 } from '../contrato/painel1.types';
import { validarPainel1 } from '../contrato/validador';
import {
  cenarioValido,
  cenarioVazio,
  cenarioSoDesconhecidos,
  cenarioLimites,
  cenarioParcial,
  cenarioInvalido,
} from '../fixtures/cenarios';
import type { Fonte, ResultadoFonte } from './Fonte';

export type NomeCenarioFixture =
  | 'valido'
  | 'vazio'
  | 'so_desconhecidos'
  | 'limites'
  | 'parcial'
  | 'invalido';

export class FonteFixture implements Fonte {
  readonly modo: 'fixture' = 'fixture';
  private readonly dadoBruto: unknown;
  private readonly nomeCenario?: NomeCenarioFixture;

  constructor(origem: NomeCenarioFixture | unknown = 'valido') {
    if (
      typeof origem === 'string' &&
      ['valido', 'vazio', 'so_desconhecidos', 'limites', 'parcial', 'invalido'].includes(origem)
    ) {
      this.nomeCenario = origem as NomeCenarioFixture;
      this.dadoBruto = this.obterDadoPorNome(this.nomeCenario);
    } else {
      this.dadoBruto = origem;
    }
  }

  private obterDadoPorNome(nome: NomeCenarioFixture): unknown {
    switch (nome) {
      case 'valido':
        return cenarioValido;
      case 'vazio':
        return cenarioVazio;
      case 'so_desconhecidos':
        return cenarioSoDesconhecidos;
      case 'limites':
        return cenarioLimites;
      case 'parcial':
        return cenarioParcial;
      case 'invalido':
        return cenarioInvalido;
    }
  }

  carregarSincrono(): ResultadoFonte<Painel1> {
    const validacao = validarPainel1(this.dadoBruto);

    if (!validacao.valido) {
      return {
        estado: 'erro',
        dados: null,
        erros: validacao.erros,
        modo: 'fixture',
      };
    }

    const dados = validacao.dados;

    if (
      this.nomeCenario === 'vazio' ||
      (dados.projetos.length === 0 && dados.diagnosticos.length === 0)
    ) {
      return {
        estado: 'vazio',
        dados,
        erros: [],
        modo: 'fixture',
      };
    }

    if (this.nomeCenario === 'parcial') {
      return {
        estado: 'parcial',
        dados,
        erros: [],
        modo: 'fixture',
      };
    }

    return {
      estado: 'sucesso',
      dados,
      erros: [],
      modo: 'fixture',
    };
  }

  async carregar(): Promise<ResultadoFonte<Painel1>> {
    return this.carregarSincrono();
  }
}

/**
 * Função utilitária para instanciar FonteFixture sem necessitar da palavra-chave `new`.
 */
export function criarFonteFixture(origem?: NomeCenarioFixture | unknown): FonteFixture {
  return new FonteFixture(origem);
}
