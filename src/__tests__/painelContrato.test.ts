import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import type {
  Painel1,
  ProjetoPainel,
  FerramentaInstalacao,
  NivelCardapio,
  FerramentaPasta,
  TipoPasta,
  FormatoRegistro,
  EstacaoEtapa,
  GrauEtapa,
  PapelEscala,
  TipoPendencia,
  EstadoAjusteMetodo,
} from '../painel/contrato/painel1.types';
import { validarPainel1 } from '../painel/contrato/validador';
import {
  exemploOficial,
  cenarioValido,
  cenarioVazio,
  cenarioSoDesconhecidos,
  cenarioLimites,
  cenarioParcial,
  cenarioInvalido,
} from '../painel/fixtures/cenarios';
import { exemploOficialLiteral } from '../painel/fixtures/exemploOficial';
import { FonteFixture } from '../painel/fonte/FonteFixture';
import { usePainelStore } from '../stores/painelStore';

describe('Contrato e Fonte no Front (painel/1)', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  describe('(a) Igualdade Byte a Byte do Esquema JSON', () => {
    it('comprova que src/painel/contrato/painel-1.schema.json é idêntico byte a byte a sociedade/central/painel-1.schema.json', () => {
      const raiz = path.resolve(__dirname, '../..');
      const caminhoOrigem = path.join(raiz, 'sociedade/central/painel-1.schema.json');
      const caminhoCopia = path.join(raiz, 'src/painel/contrato/painel-1.schema.json');

      expect(fs.existsSync(caminhoOrigem)).toBe(true);
      expect(fs.existsSync(caminhoCopia)).toBe(true);

      const bufferOrigem = fs.readFileSync(caminhoOrigem);
      const bufferCopia = fs.readFileSync(caminhoCopia);

      expect(bufferCopia.equals(bufferOrigem)).toBe(true);
      expect(bufferCopia.length).toBe(bufferOrigem.length);

      const hashOrigem = crypto.createHash('sha256').update(bufferOrigem).digest('hex');
      const hashCopia = crypto.createHash('sha256').update(bufferCopia).digest('hex');

      expect(hashCopia).toBe(hashOrigem);
      expect(hashCopia).toBe('fdf345d7dbfd654e8cd64f2f432b500ae02a5de2004af553148a63c4e7d56a2c');
    });
  });

  describe('(b) Tipagem Estática e Exemplo Oficial', () => {
    it('compila atribuição tipada de exemploOficial como Painel1 com os 3 projetos esperados', () => {
      const ex: Painel1 = exemploOficial;

      expect(ex.esquema).toBe('painel/1');
      expect(ex.maquina).toBe('notebook-exemplo');
      expect(ex.projetos).toHaveLength(3);

      const idsProjetos = ex.projetos.map((p) => p.id);
      expect(idsProjetos).toEqual(['loja-exemplo', 'app-receitas', 'diario-campo']);

      const [loja, receitas, diario] = ex.projetos;
      expect(loja.nome).toBe('Loja Exemplo');
      expect(receitas.nome).toBe('App Receitas');
      expect(diario.nome).toBe('Diário de Campo');
    });

    it('literal TypeScript do exemplo é igual, campo a campo, ao JSON oficial lido do disco', () => {
      const raiz = path.resolve(__dirname, '../..');
      const json = JSON.parse(
        fs.readFileSync(path.join(raiz, 'sociedade/central/painel-1.exemplo.json'), 'utf8'),
      );
      expect(exemploOficialLiteral).toStrictEqual(json);
      expect(exemploOficial).toStrictEqual(json);
    });

    it('exercita exaustivamente tipos literais do contrato', () => {
      const ferramentaInstalacao: FerramentaInstalacao = 'antigravity';
      const nivelCardapio: NivelCardapio = 'alta';
      const ferramentaPasta: FerramentaPasta = 'codex';
      const tipoPasta: TipoPasta = 'worktree';
      const formatoRegistro: FormatoRegistro = '2.1.0-cadeia';
      const estacaoEtapa: EstacaoEtapa = 'conferencia';
      const grauEtapa: GrauEtapa = 'A';
      const papelEscala: PapelEscala = 'elrond';
      const tipoPendencia: TipoPendencia = 'aprovar_ordem';
      const estadoAjusteMetodo: EstadoAjusteMetodo = 'incorporada';

      expect(ferramentaInstalacao).toBe('antigravity');
      expect(nivelCardapio).toBe('alta');
      expect(ferramentaPasta).toBe('codex');
      expect(tipoPasta).toBe('worktree');
      expect(formatoRegistro).toBe('2.1.0-cadeia');
      expect(estacaoEtapa).toBe('conferencia');
      expect(grauEtapa).toBe('A');
      expect(papelEscala).toBe('elrond');
      expect(tipoPendencia).toBe('aprovar_ordem');
      expect(estadoAjusteMetodo).toBe('incorporada');
    });
  });

  describe('(c) Validação Ajv 2020 nos Cenários', () => {
    it('aprova cenarioValido com zero erros', () => {
      const res = validarPainel1(cenarioValido);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.erros).toHaveLength(0);
        expect(res.dados.esquema).toBe('painel/1');
        expect(res.dados.projetos).toHaveLength(3);
      }
    });

    it('aprova cenarioVazio com zero erros', () => {
      const res = validarPainel1(cenarioVazio);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.erros).toHaveLength(0);
        expect(res.dados.projetos).toHaveLength(0);
        expect(res.dados.diagnosticos).toHaveLength(0);
      }
    });

    it('aprova cenarioSoDesconhecidos com zero erros', () => {
      const res = validarPainel1(cenarioSoDesconhecidos);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.erros).toHaveLength(0);
        expect(res.dados.pacote.fonte_versao).toBeNull();
      }
    });

    it('aprova cenarioLimites com strings nos limites de comprimento', () => {
      const res = validarPainel1(cenarioLimites);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.erros).toHaveLength(0);
        expect(res.dados.maquina).toHaveLength(64);
        expect(res.dados.projetos[0].id).toHaveLength(80);
        expect(res.dados.projetos[0].pastas[0].sha).toHaveLength(40);
        expect(res.dados.projetos[0].etapas[0].passagens?.[0].bloco).toHaveLength(2048);
      }
    });

    it('aprova cenarioParcial com diagnósticos de leitura parcial', () => {
      const res = validarPainel1(cenarioParcial);
      expect(res.valido).toBe(true);
      if (res.valido) {
        expect(res.erros).toHaveLength(0);
        expect(res.dados.projetos.length).toBeGreaterThan(0);
        expect(res.dados.diagnosticos.some((d) => d.motivo.includes('leitura parcial'))).toBe(true);
      }
    });

    it('reprova cenarioInvalido retornando lista de erros detalhada', () => {
      const res = validarPainel1(cenarioInvalido);
      expect(res.valido).toBe(false);
      if (!res.valido) {
        expect(res.dados).toBeNull();
        expect(res.erros.length).toBeGreaterThan(0);
      }
    });
  });

  describe('(d) FonteFixture e usePainelStore lidando com Erro e Cenários', () => {
    it('FonteFixture com payload inválido retorna estado de erro com erros e dados null', () => {
      const fonte = new FonteFixture(cenarioInvalido);
      const res = fonte.carregarSincrono();

      expect(res.estado).toBe('erro');
      expect(res.dados).toBeNull();
      expect(res.erros.length).toBeGreaterThan(0);
      expect(res.modo).toBe('fixture');
    });

    it('FonteFixture assíncrono com cenário inválido retorna estado de erro', async () => {
      const fonte = new FonteFixture('invalido');
      const res = await fonte.carregar();

      expect(res.estado).toBe('erro');
      expect(res.dados).toBeNull();
      expect(res.erros.length).toBeGreaterThan(0);
    });

    it('usePainelStore entra em estado de erro ao carregar dado bruto inválido e nunca renderiza pela metade', () => {
      const store = usePainelStore.getState();
      store.carregarDadoBruto(cenarioInvalido);

      const estadoAtual = usePainelStore.getState();
      expect(estadoAtual.estado).toBe('erro');
      expect(estadoAtual.dados).toBeNull();
      expect(estadoAtual.erros.length).toBeGreaterThan(0);
      expect(estadoAtual.projetoSelecionadoId).toBeNull();
    });

    it('usePainelStore transita entre cenários válido, vazio, parcial e so_desconhecidos', () => {
      const store = usePainelStore.getState();

      store.selecionarCenario('vazio');
      expect(usePainelStore.getState().estado).toBe('vazio');
      expect(usePainelStore.getState().dados?.projetos).toHaveLength(0);
      expect(usePainelStore.getState().projetoSelecionadoId).toBeNull();

      store.selecionarCenario('parcial');
      expect(usePainelStore.getState().estado).toBe('parcial');
      expect(usePainelStore.getState().dados?.projetos.length).toBeGreaterThan(0);

      store.selecionarCenario('so_desconhecidos');
      expect(usePainelStore.getState().estado).toBe('sucesso');
      expect(usePainelStore.getState().dados?.pacote.fonte_versao).toBeNull();

      store.selecionarCenario('valido');
      expect(usePainelStore.getState().estado).toBe('sucesso');
      expect(usePainelStore.getState().dados?.projetos).toHaveLength(3);
      expect(usePainelStore.getState().projetoSelecionadoId).toBe('loja-exemplo');
    });

    it('usePainelStore carregar() assíncrono suporta definirEstado', async () => {
      const store = usePainelStore.getState();
      store.definirEstado('carregando');
      expect(usePainelStore.getState().estado).toBe('carregando');

      await store.carregar(new FonteFixture('valido'));
      expect(usePainelStore.getState().estado).toBe('sucesso');
      expect(usePainelStore.getState().dados).not.toBeNull();
    });

    it('usePainelStore selecionarProjeto atualiza seleção', () => {
      const store = usePainelStore.getState();
      store.selecionarProjeto('app-receitas');
      expect(usePainelStore.getState().projetoSelecionadoId).toBe('app-receitas');

      store.selecionarProjeto(null);
      expect(usePainelStore.getState().projetoSelecionadoId).toBeNull();
    });
  });

  describe('(e) Preservação Estrita de Campos null (Regra D08)', () => {
    it('mantém campos null exatamente como null na store e nos dados carregados', () => {
      const store = usePainelStore.getState();
      const dados = store.dados;
      expect(dados).not.toBeNull();
      if (!dados) return;

      // Projeto diario-campo
      const diario = dados.projetos.find((p) => p.id === 'diario-campo') as ProjetoPainel;
      expect(diario).toBeDefined();
      expect(diario.nucleo).toBeNull();
      expect(diario.pastas[0].ramo).toBeNull();
      expect(diario.pastas[0].sha).toBeNull();
      expect(diario.pastas[0].limpa).toBeNull();

      // Loja exemplo revisor modelo_no_log
      const loja = dados.projetos.find((p) => p.id === 'loja-exemplo') as ProjetoPainel;
      expect(loja).toBeDefined();
      const etapaE3 = loja.etapas.find((e) => e.id === 'e3-carrinho');
      expect(etapaE3).toBeDefined();
      expect(etapaE3?.decisao).toBeNull();
      expect(etapaE3?.grau).toBeNull();

      const interacaoRevisor = etapaE3?.interacoes?.find((i) => i.escala.papel === 'revisor');
      expect(interacaoRevisor).toBeDefined();
      expect(interacaoRevisor?.modelo_no_log).toBeNull();

      // Diagnóstico com projeto null
      const diagSemProjeto = dados.diagnosticos.find((d) => d.campo === 'pacote.instalacoes[2].origem');
      expect(diagSemProjeto).toBeDefined();
      expect(diagSemProjeto?.projeto).toBeNull();

      // Cenário só desconhecidos: fonte_versao null
      const resDesconhecidos = new FonteFixture('so_desconhecidos').carregarSincrono();
      expect(resDesconhecidos.dados?.pacote.fonte_versao).toBeNull();
    });
  });
});
