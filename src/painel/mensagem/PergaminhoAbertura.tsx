import React, { useEffect, useMemo, useState } from 'react';
import { MolduraPergaminho, SeloEstado } from '@/app/rpgTheme';
import { usePainelStore } from '@/stores/painelStore';
import type {
  ItemCardapio,
  PapelEscala,
  ProjetoPainel,
} from '../contrato/painel1.types';
import {
  copiarMensagemSegura,
  gerarMensagemAbertura,
  obterOpcoesCardapio,
  obterPlataformasCardapio,
  PAPEIS_DISPONIVEIS,
  prepararTextoParaCopia,
} from './geradorMensagem';

export interface PergaminhoAberturaProps {
  projetos?: ProjetoPainel[];
  cardapio?: ItemCardapio[];
  className?: string;
}

const SELECT_CLASSES =
  'w-full min-h-[44px] px-3 py-2 rounded border border-amber-800/80 bg-stone-950 text-stone-100 text-sm font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors';

function resolverEtapaPadrao(projeto?: ProjetoPainel): string {
  if (!projeto || projeto.etapas.length === 0) {
    return 'e1-inicial';
  }
  const carrinho = projeto.etapas.find((e) => e.id === 'e3-carrinho');
  if (carrinho) return carrinho.id;

  const emAndamento = projeto.etapas.find((e) => e.estacao !== 'encerrada');
  if (emAndamento) return emAndamento.id;

  return projeto.etapas[projeto.etapas.length - 1].id;
}

function chaveOpcaoCardapio(item: ItemCardapio): string {
  return `${item.nivel}::${item.modelo}::${item.esforco}`;
}

export const PergaminhoAbertura: React.FC<PergaminhoAberturaProps> = ({
  projetos: projetosProp,
  cardapio: cardapioProp,
  className = '',
}) => {
  const dadosStore = usePainelStore((s) => s.dados);
  const projetos = projetosProp ?? dadosStore?.projetos ?? [];
  const cardapio = cardapioProp ?? dadosStore?.cardapio ?? [];

  const plataformas = useMemo(() => obterPlataformasCardapio(cardapio), [cardapio]);

  const projetoInicialId = useMemo(() => {
    const loja = projetos.find((p) => p.id === 'loja-exemplo');
    return loja ? loja.id : projetos[0]?.id ?? 'loja-exemplo';
  }, [projetos]);

  const [projetoId, setProjetoId] = useState<string>(projetoInicialId);

  const projetoAtual = useMemo(
    () => projetos.find((p) => p.id === projetoId) ?? projetos[0],
    [projetos, projetoId]
  );

  const [etapaId, setEtapaId] = useState<string>(() =>
    resolverEtapaPadrao(projetos.find((p) => p.id === projetoInicialId) ?? projetos[0])
  );

  const [papel, setPapel] = useState<PapelEscala>('coordenador');

  const plataformaInicial = useMemo(() => {
    return plataformas.includes('Antigravity')
      ? 'Antigravity'
      : plataformas[0] ?? 'Antigravity';
  }, [plataformas]);

  const [plataforma, setPlataforma] = useState<string>(plataformaInicial);

  const opcoesPlataforma = useMemo(
    () => obterOpcoesCardapio(cardapio, plataforma),
    [cardapio, plataforma]
  );

  const [chaveEscala, setChaveEscala] = useState<string>(() => {
    const opcoesIniciais = obterOpcoesCardapio(cardapio, plataformaInicial);
    const moderada =
      opcoesIniciais.find((o) => o.nivel === 'moderada') ?? opcoesIniciais[0];
    return moderada ? chaveOpcaoCardapio(moderada) : '';
  });

  const [incluirSubagentes, setIncluirSubagentes] = useState<boolean>(true);

  const modelosSubagentesDisponiveis = useMemo(() => {
    const modelosDaPlataforma = opcoesPlataforma.map((o) => o.modelo);
    const todosModelos = cardapio.map((o) => o.modelo);
    const unicos = Array.from(new Set([...modelosDaPlataforma, ...todosModelos]));
    return unicos;
  }, [opcoesPlataforma, cardapio]);

  const [subAlta, setSubAlta] = useState<string>(() => {
    const item = obterOpcoesCardapio(cardapio, plataformaInicial, 'alta')[0];
    return item?.modelo ?? modelosSubagentesDisponiveis[0] ?? '';
  });

  const [subModerada, setSubModerada] = useState<string>(() => {
    const item = obterOpcoesCardapio(cardapio, plataformaInicial, 'moderada')[0];
    return item?.modelo ?? modelosSubagentesDisponiveis[0] ?? '';
  });

  const [subSimples, setSubSimples] = useState<string>(() => {
    const item = obterOpcoesCardapio(cardapio, plataformaInicial, 'simples')[0];
    return item?.modelo ?? modelosSubagentesDisponiveis[0] ?? '';
  });

  const [copiado, setCopiado] = useState<boolean>(false);

  // Sincroniza quando a lista de projetos ou cardápio muda (ex.: troca de cenário)
  useEffect(() => {
    if (projetos.length > 0 && !projetos.some((p) => p.id === projetoId)) {
      const novoProj = projetos.find((p) => p.id === 'loja-exemplo') ?? projetos[0];
      setProjetoId(novoProj.id);
      setEtapaId(resolverEtapaPadrao(novoProj));
    }
  }, [projetos, projetoId]);

  const handleTrocarProjeto = (novoId: string) => {
    setProjetoId(novoId);
    const proj = projetos.find((p) => p.id === novoId);
    setEtapaId(resolverEtapaPadrao(proj));
    setCopiado(false);
  };

  const handleTrocarPlataforma = (novaPlataforma: string) => {
    setPlataforma(novaPlataforma);
    const novasOpcoes = obterOpcoesCardapio(cardapio, novaPlataforma);
    const moderada = novasOpcoes.find((o) => o.nivel === 'moderada') ?? novasOpcoes[0];
    if (moderada) {
      setChaveEscala(chaveOpcaoCardapio(moderada));
    }
    const alta = novasOpcoes.find((o) => o.nivel === 'alta')?.modelo ?? moderada?.modelo;
    const mod = novasOpcoes.find((o) => o.nivel === 'moderada')?.modelo ?? moderada?.modelo;
    const simp = novasOpcoes.find((o) => o.nivel === 'simples')?.modelo ?? moderada?.modelo;
    if (alta) setSubAlta(alta);
    if (mod) setSubModerada(mod);
    if (simp) setSubSimples(simp);
    setCopiado(false);
  };

  const itemEscalaSelecionado = useMemo(() => {
    return (
      opcoesPlataforma.find((o) => chaveOpcaoCardapio(o) === chaveEscala) ??
      opcoesPlataforma.find((o) => o.nivel === 'moderada') ??
      opcoesPlataforma[0]
    );
  }, [opcoesPlataforma, chaveEscala]);

  const modeloSelecionado = itemEscalaSelecionado?.modelo ?? '';
  const esforcoSelecionado = itemEscalaSelecionado?.esforco ?? '';

  const mensagemBruta = useMemo(() => {
    return gerarMensagemAbertura({
      projetoId,
      etapaId,
      papel,
      plataforma,
      modelo: modeloSelecionado,
      esforco: esforcoSelecionado,
      subagentes: incluirSubagentes
        ? {
            alta: subAlta,
            moderada: subModerada,
            simples: subSimples,
          }
        : undefined,
    });
  }, [
    projetoId,
    etapaId,
    papel,
    plataforma,
    modeloSelecionado,
    esforcoSelecionado,
    incluirSubagentes,
    subAlta,
    subModerada,
    subSimples,
  ]);

  const mensagemSegura = useMemo(
    () => prepararTextoParaCopia(mensagemBruta),
    [mensagemBruta]
  );

  const handleCopiar = async () => {
    const resultado = await copiarMensagemSegura(mensagemBruta);
    if (resultado.copiado) {
      setCopiado(true);
    }
  };

  const etapasDoProjeto = projetoAtual?.etapas ?? [];

  return (
    <MolduraPergaminho
      variante="destaque"
      titulo="IV. Pergaminho de Abertura"
      subtitulo="Montar mensagem de abertura (sc.py abertura · pacote 3.4.0)"
      selo={<SeloEstado estado="em_dia" rotulo="5 linhas" />}
      className={className}
    >
      <div className="space-y-3">
        {/* Linha 1: Projeto e Etapa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="pergaminho-projeto"
              className="block text-xs font-medium text-amber-200 mb-1"
            >
              Projeto
            </label>
            <select
              id="pergaminho-projeto"
              value={projetoId}
              onChange={(e) => handleTrocarProjeto(e.target.value)}
              className={SELECT_CLASSES}
            >
              {projetos.length > 0 ? (
                projetos.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.nome} ({proj.id})
                  </option>
                ))
              ) : (
                <option value="loja-exemplo">loja-exemplo</option>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="pergaminho-etapa"
              className="block text-xs font-medium text-amber-200 mb-1"
            >
              Etapa
            </label>
            <select
              id="pergaminho-etapa"
              value={etapaId}
              onChange={(e) => {
                setEtapaId(e.target.value);
                setCopiado(false);
              }}
              className={SELECT_CLASSES}
            >
              {etapasDoProjeto.length > 0 ? (
                etapasDoProjeto.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>
                    {etapa.id} ({etapa.estacao})
                  </option>
                ))
              ) : (
                <option value={etapaId}>{etapaId} (sem etapas registradas)</option>
              )}
            </select>
          </div>
        </div>

        {/* Linha 2: Papel e Plataforma */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="pergaminho-papel"
              className="block text-xs font-medium text-amber-200 mb-1"
            >
              Papel
            </label>
            <select
              id="pergaminho-papel"
              value={papel}
              onChange={(e) => {
                setPapel(e.target.value as PapelEscala);
                setCopiado(false);
              }}
              className={SELECT_CLASSES}
            >
              {PAPEIS_DISPONIVEIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pergaminho-plataforma"
              className="block text-xs font-medium text-amber-200 mb-1"
            >
              Plataforma
            </label>
            <select
              id="pergaminho-plataforma"
              value={plataforma}
              onChange={(e) => handleTrocarPlataforma(e.target.value)}
              className={SELECT_CLASSES}
            >
              {plataformas.map((plat) => (
                <option key={plat} value={plat}>
                  {plat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 3: Nível / Modelo e Esforço (exclusivamente do cardápio) */}
        <div>
          <label
            htmlFor="pergaminho-escala"
            className="block text-xs font-medium text-amber-200 mb-1"
          >
            Nível / Modelo e Esforço (cardápio)
          </label>
          <select
            id="pergaminho-escala"
            value={
              itemEscalaSelecionado ? chaveOpcaoCardapio(itemEscalaSelecionado) : chaveEscala
            }
            onChange={(e) => {
              setChaveEscala(e.target.value);
              setCopiado(false);
            }}
            className={SELECT_CLASSES}
          >
            {opcoesPlataforma.map((item) => {
              const chave = chaveOpcaoCardapio(item);
              return (
                <option key={chave} value={chave}>
                  {item.nivel}: {item.modelo} · esforço {item.esforco}
                </option>
              );
            })}
          </select>
        </div>

        {/* Linha 4: Subagentes por nível */}
        <div className="pt-2 border-t border-amber-900/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="pergaminho-incluir-subagentes"
              className="inline-flex items-center gap-2 min-h-[44px] text-xs font-medium text-amber-200 cursor-pointer select-none"
            >
              <input
                id="pergaminho-incluir-subagentes"
                type="checkbox"
                checked={incluirSubagentes}
                onChange={(e) => {
                  setIncluirSubagentes(e.target.checked);
                  setCopiado(false);
                }}
                className="w-4 h-4 accent-amber-500 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
              <span>Incluir subagentes por nível (alta, moderada, simples)</span>
            </label>
          </div>

          {incluirSubagentes && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="pergaminho-subagente-alta"
                  className="block text-[11px] font-medium text-stone-300 mb-1"
                >
                  Subagente (alta)
                </label>
                <select
                  id="pergaminho-subagente-alta"
                  value={subAlta}
                  onChange={(e) => {
                    setSubAlta(e.target.value);
                    setCopiado(false);
                  }}
                  className={SELECT_CLASSES}
                >
                  {modelosSubagentesDisponiveis.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="pergaminho-subagente-moderada"
                  className="block text-[11px] font-medium text-stone-300 mb-1"
                >
                  Subagente (moderada)
                </label>
                <select
                  id="pergaminho-subagente-moderada"
                  value={subModerada}
                  onChange={(e) => {
                    setSubModerada(e.target.value);
                    setCopiado(false);
                  }}
                  className={SELECT_CLASSES}
                >
                  {modelosSubagentesDisponiveis.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="pergaminho-subagente-simples"
                  className="block text-[11px] font-medium text-stone-300 mb-1"
                >
                  Subagente (simples)
                </label>
                <select
                  id="pergaminho-subagente-simples"
                  value={subSimples}
                  onChange={(e) => {
                    setSubSimples(e.target.value);
                    setCopiado(false);
                  }}
                  className={SELECT_CLASSES}
                >
                  {modelosSubagentesDisponiveis.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Caixa de pré-visualização */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-amber-200">
              Pré-visualização (filtrada por redactSecrets)
            </span>
          </div>
          <pre
            aria-label="Pré-visualização da mensagem de abertura"
            className="p-3 rounded border border-amber-900/70 bg-stone-950 text-amber-100 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"
          >
            {mensagemSegura}
          </pre>
        </div>

        {/* Ação de cópia acessível */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopiar}
            className="min-h-[44px] px-4 py-2 rounded border border-amber-500 bg-amber-900/60 hover:bg-amber-800/70 text-amber-100 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Copiar mensagem
          </button>

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
