import React, { useMemo, useState } from 'react';
import { MolduraPergaminho, SeloEstado } from '@/app/rpgTheme';
import { usePainelStore } from '@/stores/painelStore';
import type {
  ItemCardapio,
  NivelCardapio,
  PapelEscala,
  ProjetoPainel,
} from '../contrato/painel1.types';
import { copiarMensagemSegura, PAPEIS_DISPONIVEIS, prepararTextoParaCopia } from './geradorMensagem';
import {
  chaveOpcaoCardapio,
  escolherPlataforma,
  montarAbertura,
  NIVEIS_SUBAGENTE,
  selecaoInicial,
  type SelecaoAbertura,
} from './escalaAbertura';

export interface PergaminhoAberturaProps {
  projetos?: ProjetoPainel[];
  cardapio?: ItemCardapio[];
  className?: string;
}

const SELECT_CLASSES =
  'w-full min-h-[44px] px-3 py-2 rounded border border-amber-800/80 bg-stone-950 text-stone-100 text-sm font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed';

const ID_MOTIVO = 'pergaminho-motivo-bloqueio';
const ID_AVISO_SUB = 'pergaminho-aviso-subagentes';

interface CampoProps {
  id: string;
  rotulo: string;
  valor: string | null;
  opcoes: Array<{ valor: string; texto: string }>;
  vazio: string;
  aoMudar: (valor: string) => void;
  rotuloClasse?: string;
  descritoPor?: string;
}

/**
 * Seletor rotulado; sem opções, fica desativado e mostra o motivo como única opção.
 * Escolha que sumiu do instantâneo continua visível (marcada) até o usuário escolher outra.
 */
const Campo: React.FC<CampoProps> = ({
  id,
  rotulo,
  valor,
  opcoes,
  vazio,
  aoMudar,
  rotuloClasse = 'block text-xs font-medium text-amber-200 mb-1',
  descritoPor,
}) => {
  const fora = valor !== null && opcoes.length > 0 && !opcoes.some((o) => o.valor === valor);
  return (
  <div>
    <label htmlFor={id} className={rotuloClasse}>
      {rotulo}
    </label>
    <select
      id={id}
      value={opcoes.length > 0 ? valor ?? '' : ''}
      disabled={opcoes.length === 0}
      aria-invalid={fora ? 'true' : undefined}
      aria-describedby={fora ? ID_MOTIVO : descritoPor}
      onChange={(e) => aoMudar(e.target.value)}
      className={SELECT_CLASSES}
    >
      {fora && (
        <option value={valor as string} disabled>
          {valor} (não está mais no instantâneo)
        </option>
      )}
      {opcoes.length > 0 ? (
        opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))
      ) : (
        <option value="">{vazio}</option>
      )}
    </select>
  </div>
  );
};

export const PergaminhoAbertura: React.FC<PergaminhoAberturaProps> = ({
  projetos: projetosProp,
  cardapio: cardapioProp,
  className = '',
}) => {
  const dadosStore = usePainelStore((s) => s.dados);
  const projetos = projetosProp ?? dadosStore?.projetos ?? [];
  const cardapio = cardapioProp ?? dadosStore?.cardapio;

  const [bruta, setBruta] = useState<SelecaoAbertura>(selecaoInicial);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Revalida a cada render: se o instantâneo mudar, nada inválido sobrevive na tela.
  const resultado = useMemo(
    () => montarAbertura(projetos, cardapio, bruta),
    [projetos, cardapio, bruta]
  );
  const { selecao, opcoes, bloqueios, avisoSubagentes, mensagem } = resultado;
  const bloqueado = mensagem === null;

  const alterar = (parcial: Partial<SelecaoAbertura>) => {
    setBruta((b) => ({ ...b, ...parcial }));
    setCopiado(false);
  };

  const trocarPlataforma = (plataforma: string) => {
    setBruta((b) => escolherPlataforma(cardapio, b, plataforma));
    setCopiado(false);
  };

  const handleCopiar = async () => {
    if (mensagem === null) return;
    const r = await copiarMensagemSegura(mensagem);
    if (r.copiado) setCopiado(true);
  };

  const projetoAtual = projetos.find((p) => p.id === selecao.projetoId);

  return (
    <MolduraPergaminho
      variante="destaque"
      titulo="IV. Pergaminho de Abertura"
      subtitulo="Montar mensagem de abertura (sc.py abertura · pacote 3.4.0)"
      selo={
        bloqueado ? (
          <SeloEstado estado="desconhecido" rotulo="escala incompleta" />
        ) : (
          <SeloEstado estado="em_dia" rotulo="5 linhas" />
        )
      }
      className={className}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo
            id="pergaminho-projeto"
            rotulo="Projeto"
            valor={selecao.projetoId}
            opcoes={projetos.map((p) => ({ valor: p.id, texto: `${p.nome} (${p.id})` }))}
            vazio="nenhum projeto coletado"
            aoMudar={(projetoId) => alterar({ projetoId, etapaId: null })}
          />
          <Campo
            id="pergaminho-etapa"
            rotulo="Etapa"
            valor={selecao.etapaId}
            opcoes={(projetoAtual?.etapas ?? []).map((e) => ({
              valor: e.id,
              texto: `${e.id} (${e.estacao})`,
            }))}
            vazio="nenhuma etapa coletada"
            aoMudar={(etapaId) => alterar({ etapaId })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo
            id="pergaminho-papel"
            rotulo="Papel"
            valor={selecao.papel}
            opcoes={PAPEIS_DISPONIVEIS.map((p) => ({ valor: p, texto: p }))}
            vazio="sem papéis"
            aoMudar={(papel) => alterar({ papel: papel as PapelEscala })}
          />
          <Campo
            id="pergaminho-plataforma"
            rotulo="Plataforma"
            valor={selecao.plataforma}
            opcoes={opcoes.plataformas.map((p) => ({ valor: p, texto: p }))}
            vazio="cardápio indisponível"
            aoMudar={trocarPlataforma}
          />
        </div>

        <Campo
          id="pergaminho-escala"
          rotulo="Nível / Modelo e Esforço (cardápio)"
          valor={selecao.chaveEscala}
          opcoes={opcoes.escala.map((i) => ({
            valor: chaveOpcaoCardapio(i),
            texto: `${i.nivel}: ${i.modelo} · esforço ${i.esforco}`,
          }))}
          vazio="cardápio indisponível"
          aoMudar={(chaveEscala) => alterar({ chaveEscala })}
        />

        <div className="pt-2 border-t border-amber-900/40 space-y-2.5">
          <label
            htmlFor="pergaminho-incluir-subagentes"
            className="inline-flex items-center gap-2 min-h-[44px] text-xs font-medium text-amber-200 cursor-pointer select-none"
          >
            <input
              id="pergaminho-incluir-subagentes"
              type="checkbox"
              checked={selecao.incluirSubagentes}
              aria-describedby={avisoSubagentes ? ID_AVISO_SUB : undefined}
              onChange={(e) => alterar({ incluirSubagentes: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
            <span>Incluir subagentes por nível (alta, moderada, simples)</span>
          </label>

          {selecao.incluirSubagentes && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {NIVEIS_SUBAGENTE.map((nivel: NivelCardapio) => (
                <Campo
                  key={nivel}
                  id={`pergaminho-subagente-${nivel}`}
                  rotulo={`Subagente (${nivel})`}
                  rotuloClasse="block text-[11px] font-medium text-stone-300 mb-1"
                  valor={selecao.subagentes[nivel]}
                  opcoes={opcoes.subagentes[nivel].map((m) => ({ valor: m, texto: m }))}
                  vazio="sem opção no cardápio"
                  descritoPor={avisoSubagentes ? ID_AVISO_SUB : undefined}
                  aoMudar={(modelo) => {
                    setBruta((b) => ({ ...b, subagentes: { ...b.subagentes, [nivel]: modelo } }));
                    setCopiado(false);
                  }}
                />
              ))}
            </div>
          )}

          {avisoSubagentes && (
            <p id={ID_AVISO_SUB} className="text-xs text-amber-200">
              <span aria-hidden="true">⚠ </span>
              {avisoSubagentes}
            </p>
          )}
        </div>

        <div className="pt-2">
          <span className="block text-xs font-medium text-amber-200 mb-1">
            Pré-visualização (filtrada por redactSecrets)
          </span>
          <pre
            aria-label="Pré-visualização da mensagem de abertura"
            className="p-3 rounded border border-amber-900/70 bg-stone-950 text-amber-100 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"
          >
            {mensagem !== null
              ? prepararTextoParaCopia(mensagem)
              : 'Prévia indisponível: a escala está incompleta (veja o motivo junto ao botão).'}
          </pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopiar}
            disabled={bloqueado}
            aria-disabled={bloqueado ? 'true' : 'false'}
            aria-describedby={bloqueado ? ID_MOTIVO : undefined}
            className="min-h-[44px] px-4 py-2 rounded border border-amber-500 bg-amber-900/60 hover:bg-amber-800/70 text-amber-100 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-amber-900/60"
          >
            Copiar mensagem
          </button>

          {bloqueado && (
            <div id={ID_MOTIVO} className="text-xs text-amber-200 space-y-0.5">
              {bloqueios.map((m) => (
                <p key={m}>
                  <span aria-hidden="true">✕ </span>
                  {m}
                </p>
              ))}
            </div>
          )}

          {copiado && (
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-500/60 bg-emerald-950/70 text-emerald-200 text-xs font-mono"
            >
              <span aria-hidden="true">✓</span>
              <span>Mensagem copiada!</span>
            </span>
          )}
        </div>
      </div>
    </MolduraPergaminho>
  );
};

export default PergaminhoAbertura;
