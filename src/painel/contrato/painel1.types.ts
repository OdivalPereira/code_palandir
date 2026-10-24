/**
 * Tipos TypeScript do esquema painel/1
 *
 * Escrito à mão conforme especificação da etapa p2-leitura e arquitetura.md (Ponto 8.5).
 * Preserva estritamente `| null` em todos os campos anuláveis (regra D08).
 */

export type FerramentaInstalacao = 'claude' | 'codex' | 'antigravity' | 'agents' | 'outra';

export type NivelCardapio = 'simples' | 'moderada' | 'alta';

export type FerramentaPasta = 'claude' | 'codex' | 'antigravity' | 'nenhuma';

export type TipoPasta = 'canonica' | 'worktree' | 'clone' | 'copia_revisao';

export type FormatoRegistro = 'pre-pacote' | '2.1.0' | '2.1.0-cadeia' | 'desconhecido';

export type EstacaoEtapa =
  | 'pedido'
  | 'ordem'
  | 'execucao'
  | 'conferencia'
  | 'revisao'
  | 'decisao'
  | 'encerrada'
  | 'desconhecida';

export type GrauEtapa = 'A' | 'B' | 'C' | 'autoconferencia' | 'emulacao' | null;

export type PapelEscala =
  | 'arquiteto'
  | 'coordenador'
  | 'revisor'
  | 'aragorn'
  | 'elrond'
  | 'galadriel'
  | 'legolas'
  | 'jules';

export type TipoPendencia =
  | 'aprovar_ordem'
  | 'decidir'
  | 'revisao_devida'
  | 'passagem_a_levar'
  | 'troca_vencendo'
  | 'versao_defasada'
  | 'divergencia'
  | 'outro';

export type EstadoAjusteMetodo =
  | 'identificada'
  | 'em_avaliacao'
  | 'aceita'
  | 'incorporada'
  | 'mantida_local'
  | 'rejeitada'
  | 'adiada';

export interface InstalacaoPacote {
  ferramenta: FerramentaInstalacao;
  versao: string | null;
  origem: string | null;
  alteracao_local?: boolean | null;
}

export interface PacotePainel {
  fonte_versao: string | null;
  instalacoes: InstalacaoPacote[];
}

export interface ItemCardapio {
  plataforma: string;
  fornecedor: string;
  nivel: NivelCardapio;
  modelo: string;
  esforco: string;
}

export interface SubagentesEscala {
  simples?: string;
  moderada?: string;
  alta?: string;
}

export interface EscalaAgente {
  papel: PapelEscala;
  plataforma: string;
  fornecedor: string;
  modelo: string;
  esforco: string;
  subagentes?: SubagentesEscala;
}

export interface InteracaoEtapa {
  escala: EscalaAgente;
  inicio: string;
  modelo_no_log?: string | null;
  avisos?: string[];
}

export interface PassagemEtapa {
  de: string;
  para: string;
  quando: string;
  bloco?: string;
}

export interface EtapaProjeto {
  id: string;
  estacao: EstacaoEtapa;
  decisao?: string | null;
  grau?: GrauEtapa;
  interacoes?: InteracaoEtapa[];
  passagens?: PassagemEtapa[];
}

export interface PastaProjeto {
  ferramenta: FerramentaPasta;
  caminho: string;
  tipo: TipoPasta;
  ramo?: string | null;
  sha?: string | null;
  limpa?: boolean | null;
}

export interface PendenciaProjeto {
  tipo: TipoPendencia;
  texto: string;
  etapa?: string | null;
}

export interface AjusteMetodo {
  id: string;
  estado: EstadoAjusteMetodo;
  resumo?: string;
}

export interface ProjetoPainel {
  id: string;
  nome: string;
  envio_ligado?: boolean;
  pastas: PastaProjeto[];
  nucleo: string | null;
  formato_registro?: FormatoRegistro;
  etapas: EtapaProjeto[];
  pendencias: PendenciaProjeto[];
  ajustes_metodo?: AjusteMetodo[];
}

export interface DiagnosticoPainel {
  projeto: string | null;
  campo: string;
  motivo: string;
}

export interface Painel1 {
  esquema: 'painel/1';
  coletado_em: string;
  maquina: string;
  pacote: PacotePainel;
  cardapio?: ItemCardapio[];
  projetos: ProjetoPainel[];
  diagnosticos: DiagnosticoPainel[];
}
