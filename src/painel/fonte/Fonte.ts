import type { Painel1 } from '../contrato/painel1.types';

export type EstadoCarregamentoPainel = 'carregando' | 'vazio' | 'erro' | 'parcial' | 'sucesso';

export interface ResultadoFonte<T = Painel1> {
  estado: EstadoCarregamentoPainel;
  dados: T | null;
  erros: string[];
  modo: 'fixture' | 'supabase';
}

export interface Fonte {
  modo: 'fixture' | 'supabase';
  carregar(): Promise<ResultadoFonte<Painel1>>;
  carregarSincrono?(): ResultadoFonte<Painel1>;
}
