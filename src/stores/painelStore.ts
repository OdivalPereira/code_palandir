import { create } from 'zustand';
import type { Painel1 } from '../painel/contrato/painel1.types';
import { validarPainel1 } from '../painel/contrato/validador';
import { exemploOficial } from '../painel/fixtures/cenarios';
import type { EstadoCarregamentoPainel, Fonte, ResultadoFonte } from '../painel/fonte/Fonte';
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

let ultimoPedido = 0;

const fixtureInicial = new FonteFixture('valido');
const resultadoInicial = fixtureInicial.carregarSincrono();

export const usePainelStore = create<PainelStoreState>((set, get) => ({
  estado: resultadoInicial.estado,
  dados: resultadoInicial.dados,
  erros: resultadoInicial.erros,
  cenarioAtivo: 'valido',
  projetoSelecionadoId: 'loja-exemplo',

  carregar: async (fonte?: Fonte) => {
    const pedido = ++ultimoPedido;
    set({ estado: 'carregando' });
    const fonteUtilizada = fonte || new FonteFixture(get().cenarioAtivo || 'valido');

    let resultado: ResultadoFonte<Painel1>;
    try {
      resultado = await fonteUtilizada.carregar();
    } catch (e) {
      // Fonte que rejeita (rede, Supabase) vira estado de erro, nunca "carregando" eterno (D05).
      if (pedido !== ultimoPedido) return;
      set({
        estado: 'erro',
        dados: null,
        erros: [`Falha ao carregar o instantâneo: ${e instanceof Error ? e.message : String(e)}`],
        projetoSelecionadoId: null,
      });
      return;
    }
    // Só o pedido mais recente grava: uma resposta lenta não sobrescreve a nova.
    if (pedido !== ultimoPedido) return;

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
    ultimoPedido++; // invalida um carregar() ainda em voo
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
    ultimoPedido++; // invalida um carregar() ainda em voo
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
