import { create } from 'zustand';
import type { Painel1 } from '../painel/contrato/painel1.types';
import { validarPainel1 } from '../painel/contrato/validador';
import { exemploOficial } from '../painel/fixtures/cenarios';
import type { EstadoCarregamentoPainel, Fonte } from '../painel/fonte/Fonte';
import { FonteFixture, type NomeCenarioFixture } from '../painel/fonte/FonteFixture';

export interface PainelStoreState {
  estado: EstadoCarregamentoPainel;
  dados: Painel1 | null;
  erros: string[];
  cenarioAtivo: NomeCenarioFixture | null;
  projetoSelecionadoId: string | null;

  carregar: (fonte?: Fonte) => Promise<void>;
  selecionarCenario: (cenario: NomeCenarioFixture) => void;
  carregarDadoBruto: (bruto: unknown) => void;
  definirEstado: (estado: EstadoCarregamentoPainel, erros?: string[]) => void;
  selecionarProjeto: (id: string | null) => void;
  resetar: () => void;
}

const fixtureInicial = new FonteFixture('valido');
const resultadoInicial = fixtureInicial.carregarSincrono();

export const usePainelStore = create<PainelStoreState>((set, get) => ({
  estado: resultadoInicial.estado,
  dados: resultadoInicial.dados,
  erros: resultadoInicial.erros,
  cenarioAtivo: 'valido',
  projetoSelecionadoId: 'loja-exemplo',

  carregar: async (fonte?: Fonte) => {
    set({ estado: 'carregando' });
    const fonteUtilizada = fonte || new FonteFixture(get().cenarioAtivo || 'valido');
    const resultado = await fonteUtilizada.carregar();

    let proximoProjetoId: string | null = null;
    if (resultado.dados?.projetos && resultado.dados.projetos.length > 0) {
      const atual = get().projetoSelecionadoId;
      const aindaExiste = resultado.dados.projetos.some((p) => p.id === atual);
      proximoProjetoId = aindaExiste ? atual : resultado.dados.projetos[0].id;
    }

    set({
      estado: resultado.estado,
      dados: resultado.dados,
      erros: resultado.erros,
      projetoSelecionadoId: proximoProjetoId,
    });
  },

  selecionarCenario: (cenario: NomeCenarioFixture) => {
    const fonte = new FonteFixture(cenario);
    const resultado = fonte.carregarSincrono();

    let proximoProjetoId: string | null = null;
    if (resultado.dados?.projetos && resultado.dados.projetos.length > 0) {
      const atual = get().projetoSelecionadoId;
      const aindaExiste = resultado.dados.projetos.some((p) => p.id === atual);
      proximoProjetoId = aindaExiste ? atual : resultado.dados.projetos[0].id;
    }

    set({
      cenarioAtivo: cenario,
      estado: resultado.estado,
      dados: resultado.dados,
      erros: resultado.erros,
      projetoSelecionadoId: proximoProjetoId,
    });
  },

  carregarDadoBruto: (bruto: unknown) => {
    const validacao = validarPainel1(bruto);

    if (!validacao.valido) {
      set({
        estado: 'erro',
        dados: null,
        erros: validacao.erros,
        cenarioAtivo: null,
        projetoSelecionadoId: null,
      });
      return;
    }

    const dados = validacao.dados;
    const estado: EstadoCarregamentoPainel =
      dados.projetos.length === 0 && dados.diagnosticos.length === 0 ? 'vazio' : 'sucesso';

    set({
      estado,
      dados,
      erros: [],
      cenarioAtivo: null,
      projetoSelecionadoId: dados.projetos[0]?.id || null,
    });
  },

  definirEstado: (estado: EstadoCarregamentoPainel, erros: string[] = []) => {
    set({
      estado,
      erros,
    });
  },

  selecionarProjeto: (id: string | null) => {
    set({
      projetoSelecionadoId: id,
    });
  },

  resetar: () => {
    set({
      estado: 'sucesso',
      dados: exemploOficial,
      erros: [],
      cenarioAtivo: 'valido',
      projetoSelecionadoId: 'loja-exemplo',
    });
  },
}));
