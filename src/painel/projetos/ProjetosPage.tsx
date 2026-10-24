import { classificarVersao, type ResultadoVersao } from '../regras/classificarVersao';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  EstadoTela,
  MolduraPergaminho,
  MarcoJornada,
  SeloEstado,
  SeloPapel,
  RPG_TITLE_STYLE,
} from '@/app/rpgTheme';
import { usePainelStore } from '@/stores/painelStore';
import { pluralizar } from '../formatacao';
import type {
  InteracaoEtapa,
  PassagemEtapa,
  PastaProjeto,
} from '../contrato/painel1.types';

// Só formatação do rótulo; a regra vive em classificarVersao.
function rotuloNucleo(
  nucleo: string | null,
  r: ResultadoVersao,
  detalhe: boolean
): string {
  if (nucleo === null) return 'nucleo: desconhecido';
  if (r.estado === 'em_dia') return detalhe ? `núcleo: ${nucleo}` : nucleo;
  if (r.estado === 'defasado') return `${nucleo} ! ${r.motivo}`;
  return `${nucleo} (${r.motivo})`;
}

export const ProjetosPage: React.FC = () => {
  const { id: paramId } = useParams<{ id?: string }>();
  const { estado, dados, erros, projetoSelecionadoId, selecionarProjeto } = usePainelStore();

  const [passagensExpandidas, setPassagensExpandidas] = useState<Record<string, boolean>>({});

  // Sincroniza o parâmetro :id da URL com a store do painel (só id que existe no instantâneo)
  const paramExiste = !!paramId && !!dados?.projetos?.some((p) => p.id === paramId);
  useEffect(() => {
    if (paramId && paramExiste && paramId !== projetoSelecionadoId) {
      selecionarProjeto(paramId);
    }
  }, [paramId, paramExiste, projetoSelecionadoId, selecionarProjeto]);

  // Ao escolher outra região, o foco vai ao nome dela: abaixo de xl o detalhe fica sob a lista.
  const tituloDetalheRef = useRef<HTMLHeadingElement>(null);
  const paramAnterior = useRef(paramId);
  useEffect(() => {
    if (paramId && paramAnterior.current !== paramId) {
      tituloDetalheRef.current?.focus();
    }
    paramAnterior.current = paramId;
  }, [paramId]);

  // Trata os estados de tela D05
  if (estado === 'carregando') {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="carregando"
          titulo="Mapeando as Regiões..."
          mensagem="Carregando as crônicas e acampamentos da Terra-média."
        />
      </div>
    );
  }

  if (estado === 'erro') {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="erro"
          titulo="Falha ao Mapear as Regiões"
          mensagem="O retrato recebido violou o contrato painel/1."
          detalhes={erros}
        />
      </div>
    );
  }

  if (
    estado === 'vazio' ||
    !dados ||
    !dados.projetos ||
    dados.projetos.length === 0
  ) {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="vazio"
          titulo="Nenhuma Região Mapeada"
          mensagem="Nenhum projeto encontrado nas crônicas do painel."
        />
      </div>
    );
  }

  // Região pedida pela URL que não está no instantâneo: diz isso, não mostra outra no lugar.
  if (paramId && !paramExiste) {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="vazio"
          titulo="Região não encontrada"
          mensagem={`O projeto "${paramId}" não está no instantâneo atual.`}
          acao={
            <Link
              to="/projetos"
              className="inline-flex items-center min-h-[44px] px-4 py-2 rounded border border-amber-700 bg-stone-900 text-amber-100 text-sm font-semibold hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Ver todas as regiões
            </Link>
          }
        />
      </div>
    );
  }

  const fonteVersao = dados.pacote.fonte_versao;

  // Resolve o projeto ativo (URL :id tem preferência, depois store, depois primeiro projeto)
  const idAtivo = paramId || projetoSelecionadoId || dados.projetos[0]?.id;
  const projetoAtivo =
    dados.projetos.find((p) => p.id === idAtivo) || dados.projetos[0];

  const diagsProjetoAtivo = dados.diagnosticos.filter(
    (d) => d.projeto === projetoAtivo.id
  );

  const nucAtivo = classificarVersao({
    versao: projetoAtivo.nucleo,
    fonteVersao,
    diagnosticos: diagsProjetoAtivo.length,
  });
  const pendenciasAtivo = projetoAtivo.pendencias?.length ?? 0;


  const togglePassagem = (chave: string) => {
    setPassagensExpandidas((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }));
  };

  // Coleta as passagens das etapas do projeto selecionado
  const passagensComEtapa: Array<{
    etapaId: string;
    passagem: PassagemEtapa;
    idUnico: string;
  }> = [];

  for (const etapa of projetoAtivo.etapas) {
    if (etapa.passagens && etapa.passagens.length > 0) {
      etapa.passagens.forEach((passagem, pIdx) => {
        passagensComEtapa.push({
          etapaId: etapa.id,
          passagem,
          idUnico: `${projetoAtivo.id}--${etapa.id}--passagem-${pIdx}`,
        });
      });
    }
  }

  // Coleta as interações das etapas do projeto selecionado
  const interacoesComEtapa: Array<{
    etapaId: string;
    interacao: InteracaoEtapa;
  }> = [];

  for (const etapa of projetoAtivo.etapas) {
    if (etapa.interacoes && etapa.interacoes.length > 0) {
      for (const interacao of etapa.interacoes) {
        interacoesComEtapa.push({ etapaId: etapa.id, interacao });
      }
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4">
      {/* Estado parcial D05 se ativo */}
      {estado === 'parcial' && (
        <EstadoTela
          estado="parcial"
          titulo="Leitura parcial"
          mensagem="Algumas regiões contêm diagnósticos de coleta ou dados incompletos."
        />
      )}

      {/* Layout Responsivo: Lista à esquerda em >= 1280px e detalhe à direita; empilhado em 360px */}
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 items-start w-full">
        {/* 1. LISTA DE REGIÕES */}
        <aside
          aria-label="Lista de Regiões"
          className="w-full xl:w-[360px] xl:shrink-0 space-y-3"
        >
          <div className="flex items-center justify-between pb-1 border-b border-amber-900/40">
            <h2
              style={RPG_TITLE_STYLE}
              className="text-amber-100 uppercase tracking-wide text-sm font-semibold"
            >
              Regiões ({dados.projetos.length})
            </h2>
            <span className="text-xs text-stone-400 font-mono">
              Fonte: {fonteVersao || 'desconhecida'}
            </span>
          </div>

          <ul role="list" className="space-y-2 list-none p-0 m-0">
            {dados.projetos.map((p) => {
              const isAtivo = p.id === projetoAtivo.id;
              const diags = dados.diagnosticos.filter((d) => d.projeto === p.id);
              const temDiags = diags.length > 0;
              const nucP = classificarVersao({
                versao: p.nucleo,
                fonteVersao,
                diagnosticos: diags.length,
              });
              const numPendencias = p.pendencias?.length ?? 0;
              const etapaMaisRecente =
                p.etapas && p.etapas.length > 0 ? p.etapas[p.etapas.length - 1] : null;
              const estacaoRecente = etapaMaisRecente?.estacao;

              return (
                <li key={p.id}>
                  <Link
                    to={`/projetos/${p.id}`}
                    aria-current={isAtivo ? 'page' : undefined}
                    className={`block min-h-[44px] w-full text-left p-3 rounded-lg border transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isAtivo
                        ? 'border-amber-500 bg-stone-900 ring-1 ring-amber-500/40'
                        : 'border-amber-900/50 bg-stone-950/80 hover:border-amber-700/70 hover:bg-stone-900/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        style={RPG_TITLE_STYLE}
                        className="text-amber-100 uppercase tracking-wide text-sm font-bold truncate"
                      >
                        {p.nome}
                      </h3>
                      {estacaoRecente ? (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-amber-900/60 bg-stone-950 text-amber-200 uppercase">
                          {estacaoRecente}
                        </span>
                      ) : (
                        <SeloEstado estado="desconhecido" rotulo="desconhecida ?" />
                      )}
                    </div>

                    {/* Núcleo */}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="text-stone-400">Núcleo:</span>
                      <SeloEstado
                        estado={nucP.estado}
                        rotulo={rotuloNucleo(p.nucleo, nucP, false)}
                      />
                    </div>

                    {/* Pendências e Diagnósticos */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-amber-900/30 text-xs">
                      <span className="text-stone-300 font-mono">
                        {temDiags
                          ? pluralizar(numPendencias, 'pendência conhecida', 'pendências conhecidas')
                          : pluralizar(numPendencias, 'pendência', 'pendências')}
                      </span>

                      {temDiags && (
                        <div className="flex items-center gap-1">
                          <SeloEstado
                            estado="desconhecido"
                            rotulo={`${pluralizar(diags.length, 'diagnóstico', 'diagnósticos')} · estado desconhecido`}
                          />
                          <span className="text-[10px] font-mono font-bold uppercase px-1 py-0.5 rounded border border-purple-500 bg-purple-950/90 text-purple-200">
                            NUNCA EM DIA
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* DETALHE DA REGIÃO SELECIONADA */}
        <section
          aria-label={`Detalhes da Região ${projetoAtivo.nome}`}
          className="flex-1 min-w-0 w-full space-y-4"
        >
          {/* Cabeçalho da Região Selecionada */}
          <div className="p-3 sm:p-4 rounded-lg border border-amber-900/80 bg-stone-900/90 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1
                ref={tituloDetalheRef}
                tabIndex={-1}
                style={RPG_TITLE_STYLE}
                className="text-amber-100 uppercase tracking-wider text-base sm:text-lg font-bold break-words focus:outline-none"
              >
                {projetoAtivo.nome}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                <span className="text-stone-400">Núcleo:</span>
                <SeloEstado
                  estado={nucAtivo.estado}
                  rotulo={rotuloNucleo(projetoAtivo.nucleo, nucAtivo, true)}
                />
                <span className="text-stone-400 font-mono">· ID: {projetoAtivo.id}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {diagsProjetoAtivo.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <SeloEstado
                    estado="desconhecido"
                    rotulo={`${pluralizar(diagsProjetoAtivo.length, 'diagnóstico', 'diagnósticos')} · estado desconhecido`}
                  />
                  <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded border border-purple-500 bg-purple-950 text-purple-200">
                    NUNCA EM DIA
                  </span>
                </div>
              ) : pendenciasAtivo > 0 ? (
                <SeloEstado
                  estado="atencao"
                  rotulo={pluralizar(pendenciasAtivo, 'pendência', 'pendências')}
                />
              ) : nucAtivo.estado !== 'em_dia' ? (
                <SeloEstado
                  estado={nucAtivo.estado}
                  rotulo={nucAtivo.estado === 'defasado' ? 'núcleo defasado' : 'núcleo desconhecido'}
                />
              ) : (
                <SeloEstado estado="em_dia" rotulo="Em dia" />
              )}
            </div>
          </div>

          {/* 2. MARCOS DA JORNADA (ETAPAS) */}
          <div data-testid="secao-marcos-jornada">
            <MolduraPergaminho
              titulo="Marcos da Jornada"
              subtitulo={`Etapas e estações de ${projetoAtivo.nome}`}
            >
              {projetoAtivo.etapas.length > 0 ? (
                <div className="space-y-4">
                  {projetoAtivo.etapas.map((etapa) => {
                    const isEncerrada = etapa.estacao === 'encerrada';
                    return (
                      <div
                        key={etapa.id}
                        className="p-3 rounded-lg border border-amber-900/40 bg-stone-950/60 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-200 text-sm">
                              {etapa.id}
                            </span>
                            {isEncerrada ? (
                              <span className="text-xs text-stone-300">
                                · Encerrada ({etapa.decisao || 'sem decisão'} · Grau {etapa.grau || '—'})
                              </span>
                            ) : (
                              <span className="text-xs text-stone-300">
                                · Estação: <span className="uppercase font-mono text-amber-300">{etapa.estacao}</span>
                              </span>
                            )}
                          </div>
                          <div>
                            {isEncerrada ? (
                              <SeloEstado
                                estado={etapa.decisao ? 'em_dia' : 'desconhecido'}
                                rotulo={`Encerrada (${etapa.decisao || 'sem decisão'} · Grau ${etapa.grau || '—'})`}
                              />
                            ) : (
                              <SeloEstado estado="atencao" rotulo={etapa.estacao} />
                            )}
                          </div>
                        </div>
                        <MarcoJornada
                          estacaoAtual={etapa.estacao}
                          rotulo={`Marcos da etapa ${etapa.id}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <MarcoJornada estacaoAtual="desconhecida" />
                  <div className="p-3 rounded-lg border border-purple-500/70 bg-purple-950/40 text-purple-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <SeloEstado estado="desconhecido" rotulo="estação desconhecida" />
                      <span className="text-xs font-mono font-bold uppercase text-purple-300">
                        NUNCA EM DIA
                      </span>
                      <span className="text-xs text-stone-300">
                        · Estação desconhecida (sem etapas registradas)
                      </span>
                    </div>
                    {diagsProjetoAtivo.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-purple-300">
                          Diagnósticos da região ({diagsProjetoAtivo.length}):
                        </p>
                        <ul className="space-y-1 font-mono text-xs">
                          {diagsProjetoAtivo.map((d, i) => (
                            <li
                              key={i}
                              className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-purple-200"
                            >
                              <span className="font-bold text-purple-300">? {d.campo}:</span>
                              <span className="text-stone-300 italic font-sans">{d.motivo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </MolduraPergaminho>
          </div>

          {/* 3. ACAMPAMENTOS (PASTAS POR FERRAMENTA) */}
          <div data-testid="secao-acampamentos">
            <MolduraPergaminho
              titulo="Acampamentos"
              subtitulo={`Pastas e árvores de trabalho em ${projetoAtivo.nome}`}
            >
              {projetoAtivo.pastas && projetoAtivo.pastas.length > 0 ? (
                <div className="space-y-2.5">
                  {projetoAtivo.pastas.map((pasta: PastaProjeto, idx: number) => {
                    const isClone = pasta.tipo === 'clone';
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                          isClone
                            ? 'border-amber-600/70 bg-amber-950/20'
                            : 'border-stone-800 bg-stone-950/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-200 uppercase font-mono tracking-wider">
                              {pasta.ferramenta}
                            </span>
                            {isClone ? (
                              <SeloEstado estado="atencao" rotulo="! clone" />
                            ) : (
                              <span className="font-mono px-2 py-0.5 rounded border border-stone-700 bg-stone-900 text-stone-300">
                                {pasta.tipo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {pasta.limpa === true && (
                              <SeloEstado estado="em_dia" rotulo="limpa" />
                            )}
                            {pasta.limpa === false && (
                              <SeloEstado estado="atencao" rotulo="suja" />
                            )}
                            {(pasta.limpa === null || pasta.limpa === undefined) && (
                              <SeloEstado
                                estado="desconhecido"
                                rotulo="limpa: desconhecida"
                              />
                            )}
                          </div>
                        </div>

                        <div className="font-mono text-stone-300 break-all text-[11px] bg-stone-950 px-2 py-1 rounded border border-stone-800/80">
                          {pasta.caminho}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-stone-400 font-mono text-[11px]">
                          <div className="flex items-center gap-1">
                            <span>ramo:</span>
                            {pasta.ramo ? (
                              <span className="text-stone-200 font-bold">{pasta.ramo}</span>
                            ) : (
                              <SeloEstado estado="desconhecido" rotulo="ramo: desconhecido" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span>sha:</span>
                            {pasta.sha ? (
                              <span className="text-stone-200 font-bold">{pasta.sha}</span>
                            ) : (
                              <SeloEstado estado="desconhecido" rotulo="sha: desconhecido" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-stone-400 italic py-2">
                  Nenhum acampamento registrado nesta região.
                </p>
              )}
            </MolduraPergaminho>
          </div>

          {/* 4. COMPANHIA (OCUPANTES RECENTES / INTERAÇÕES) */}
          <div data-testid="secao-companhia">
            <MolduraPergaminho
              titulo="Companhia"
              subtitulo={`Ocupantes recentes e interações em ${projetoAtivo.nome}`}
            >
              {interacoesComEtapa.length > 0 ? (
                <div className="space-y-3">
                  {interacoesComEtapa.map(({ etapaId, interacao }, idx) => {
                    const modeloNoLog = interacao.modelo_no_log;
                    const modeloEsperado = interacao.escala.modelo;

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-lg border border-stone-800 bg-stone-950/60 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <SeloPapel papel={interacao.escala.papel} />
                            <span className="text-xs text-stone-400 font-mono">
                              ({etapaId})
                            </span>
                          </div>
                          <div>
                            {/* Regra obrigatória do aceite: aviso de modelo_no_log */}
                            {modeloNoLog === null || modeloNoLog === undefined ? (
                              <SeloEstado
                                estado="desconhecido"
                                rotulo="modelo_no_log: desconhecido (null)"
                              />
                            ) : modeloNoLog !== modeloEsperado ? (
                              <SeloEstado
                                estado="atencao"
                                rotulo={`modelo_no_log diverge: ${modeloNoLog}`}
                              />
                            ) : (
                              <SeloEstado
                                estado="em_dia"
                                rotulo={`modelo_no_log: ${modeloNoLog}`}
                              />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-stone-900/60 p-2 rounded border border-stone-800/80">
                          <div>
                            <span className="text-stone-400 block text-[10px]">
                              Plataforma:
                            </span>
                            <span className="text-stone-200 font-semibold">
                              {interacao.escala.plataforma}
                            </span>
                          </div>
                          <div>
                            <span className="text-stone-400 block text-[10px]">
                              Fornecedor:
                            </span>
                            <span className="text-stone-200 font-semibold">
                              {interacao.escala.fornecedor}
                            </span>
                          </div>
                          <div>
                            <span className="text-stone-400 block text-[10px]">Modelo:</span>
                            <span className="text-stone-200 font-semibold">
                              {interacao.escala.modelo}
                            </span>
                          </div>
                          <div>
                            <span className="text-stone-400 block text-[10px]">Esforço:</span>
                            <span className="text-stone-200 font-semibold">
                              {interacao.escala.esforco}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 font-mono pt-1">
                          <div>
                            <span>Início: </span>
                            <span className="text-stone-300">{interacao.inicio}</span>
                          </div>

                          {interacao.escala.subagentes &&
                            Object.keys(interacao.escala.subagentes).length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-stone-400">Subagentes:</span>
                                {Object.entries(interacao.escala.subagentes).map(
                                  ([nivel, mod]) => (
                                    <span
                                      key={nivel}
                                      className="text-[10px] bg-stone-900 px-1.5 py-0.5 rounded border border-stone-700 text-amber-200"
                                    >
                                      {nivel}: {mod}
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                        </div>

                        {interacao.avisos && interacao.avisos.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-amber-900/30 space-y-1">
                            {interacao.avisos.map((aviso, aIdx) => (
                              <p
                                key={aIdx}
                                className="text-xs text-amber-300 font-sans italic flex items-center gap-1.5"
                              >
                                <span aria-hidden="true">⚠️</span>
                                <span>{aviso}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-stone-400 italic py-2">
                  Nenhum ocupante recente registrado para as etapas desta região.
                </p>
              )}
            </MolduraPergaminho>
          </div>

          {/* 5. MENSAGENS DE GWAIHIR (PASSAGENS) */}
          <div data-testid="secao-passagens">
            <MolduraPergaminho
              titulo="Mensagens de Gwaihir"
              subtitulo={`Passagens de bastão em ${projetoAtivo.nome}`}
            >
              {passagensComEtapa.length > 0 ? (
                <div className="space-y-3">
                  {passagensComEtapa.map((item) => {
                    const isExpandida = !!passagensExpandidas[item.idUnico];
                    return (
                      <div
                        key={item.idUnico}
                        className="rounded-lg border border-amber-900/50 bg-stone-950/70 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => togglePassagem(item.idUnico)}
                          aria-expanded={isExpandida}
                          className="min-h-[44px] w-full flex items-center justify-between gap-2 p-3 text-left transition-all hover:bg-stone-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-semibold text-amber-200 text-xs sm:text-sm">
                              {item.passagem.de} → {item.passagem.para}
                            </span>
                            <span className="text-xs text-stone-400 font-mono">
                              ({item.passagem.quando})
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-stone-800 bg-stone-900 text-stone-400">
                              {item.etapaId}
                            </span>
                          </div>
                          <span className="text-xs text-amber-400 font-mono select-none flex-shrink-0">
                            {isExpandida ? '▲ Recolher' : '▼ Expandir'}
                          </span>
                        </button>

                        {isExpandida && item.passagem.bloco && (
                          <div className="p-3 border-t border-amber-900/40 bg-stone-950/90 overflow-x-auto">
                            <pre className="font-mono text-xs text-stone-200 whitespace-pre-wrap leading-relaxed">
                              {item.passagem.bloco}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-stone-400 italic py-2">
                  Nenhuma mensagem levada por Gwaihir registrada nesta região.
                </p>
              )}
            </MolduraPergaminho>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProjetosPage;
