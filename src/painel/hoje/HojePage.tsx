import { classificarVersao, rotuloVersao } from '../regras/classificarVersao';
import React from 'react';
import {
  EstadoTela,
  MolduraPergaminho,
  RPG_TITLE_STYLE,
  SeloEstado,
} from '@/app/rpgTheme';
import { usePainelStore } from '@/stores/painelStore';
import { ordenarPendencias } from '../mensagem/geradorMensagem';
import { PergaminhoAbertura } from '../mensagem/PergaminhoAbertura';
import { pluralizar } from '../formatacao';

export const HojePage: React.FC = () => {
  const { estado, dados, erros } = usePainelStore();

  if (estado === 'carregando') {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="carregando"
          titulo="Reunindo o Conselho..."
          mensagem="Carregando o instantâneo do painel."
        />
      </div>
    );
  }

  if (estado === 'erro') {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="erro"
          titulo="Instantâneo inválido"
          mensagem="O retrato recebido violou o contrato painel/1."
          detalhes={erros}
        />
      </div>
    );
  }

  if (
    estado === 'vazio' ||
    !dados ||
    (dados.projetos.length === 0 && dados.diagnosticos.length === 0)
  ) {
    return (
      <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <EstadoTela
          estado="vazio"
          titulo="Conselho sem registros"
          mensagem="Nenhum projeto ou diagnóstico encontrado no instantâneo."
        />
      </div>
    );
  }

  const pendenciasOrdenadas = ordenarPendencias(dados.projetos);
  // Projeto com diagnóstico pode ter pendências que o coletor não leu (D08).
  const projetosIlegiveis = dados.diagnosticos.some((d) => d.projeto !== null);

  // Projetos que possuem diagnósticos ou nucleo === null (Regra D08: nunca em dia)
  const projetosEmNevoa = dados.projetos.filter((proj) => {
    const temDiag = dados.diagnosticos.some((d) => d.projeto === proj.id);
    return temDiag || proj.nucleo === null;
  });

  // Diagnósticos de projetos cujo ID não consta em dados.projetos (ex.: cenário só desconhecidos)
  const idsProjetosConhecidos = new Set(dados.projetos.map((p) => p.id));
  const diagnosticosOrfaosPorProjeto = new Map<string, typeof dados.diagnosticos>();
  for (const diag of dados.diagnosticos) {
    if (diag.projeto !== null && !idsProjetosConhecidos.has(diag.projeto)) {
      const lista = diagnosticosOrfaosPorProjeto.get(diag.projeto) ?? [];
      lista.push(diag);
      diagnosticosOrfaosPorProjeto.set(diag.projeto, lista);
    }
  }

  const diagnosticosGlobais = dados.diagnosticos.filter((d) => d.projeto === null);

  const fonteVersao = dados.pacote.fonte_versao;

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4">
      {estado === 'parcial' && (
        <EstadoTela
          estado="parcial"
          titulo="Leitura parcial"
          mensagem="Parte dos dados possui diagnósticos de coleta."
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:gap-6 items-start">
        {/* Coluna Esquerda (7/12 em >= 1280px): Seções I, II e III */}
        <div className="xl:col-span-7 space-y-4 min-w-0">
          {/* SEÇÃO I — ESPERA PELO CONSELHO */}
          <MolduraPergaminho
            titulo="I. Espera pelo Conselho"
            subtitulo="Pendências priorizadas em todos os projetos"
            selo={
              <SeloEstado
                estado={
                  pendenciasOrdenadas.length > 0
                    ? 'atencao'
                    : projetosIlegiveis
                    ? 'desconhecido'
                    : 'em_dia'
                }
                rotulo={
                  projetosIlegiveis
                    ? pluralizar(pendenciasOrdenadas.length, 'pendência conhecida', 'pendências conhecidas')
                    : pluralizar(pendenciasOrdenadas.length, 'pendência', 'pendências')
                }
              />
            }
          >
            {pendenciasOrdenadas.length === 0 ? (
              <p className="text-sm text-stone-300 font-sans">
                Nenhuma decisão ou revisão aguardando nas regiões conhecidas.
              </p>
            ) : (
              <ol
                aria-label="Lista de pendências do Conselho"
                className="space-y-2.5"
              >
                {pendenciasOrdenadas.map((item, idx) => (
                  <li
                    key={`${item.projetoId}-${item.tipo}-${idx}`}
                    className="p-3 rounded border border-amber-900/50 bg-stone-950/80 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SeloEstado estado="atencao" rotulo={item.rotuloTipo} />
                      <span className="text-xs font-semibold text-amber-100 font-sans">
                        {item.projetoNome}
                        {item.etapa ? ` · ${item.etapa}` : ''}
                      </span>
                    </div>
                    <p className="text-sm text-stone-200 font-sans">{item.texto}</p>
                  </li>
                ))}
              </ol>
            )}
          </MolduraPergaminho>

          {/* SEÇÃO II — TERRAS EM NÉVOA · DESCONHECIDO */}
          <MolduraPergaminho
            variante="nevoa"
            titulo="II. Terras em Névoa · Desconhecido"
            subtitulo="Projetos e campos não coletados ou ilegíveis (D08: nunca aparecem como em dia)"
            selo={<SeloEstado estado="desconhecido" rotulo="NUNCA EM DIA" />}
          >
            <div className="space-y-3">
              {projetosEmNevoa.map((proj) => {
                const diagsProj = dados.diagnosticos.filter(
                  (d) => d.projeto === proj.id
                );

                return (
                  <div
                    key={proj.id}
                    className="p-3 rounded border border-purple-500/60 bg-purple-950/40 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3
                        style={RPG_TITLE_STYLE}
                        className="text-sm font-bold uppercase tracking-wide text-purple-100"
                      >
                        {proj.nome}
                      </h3>
                      <SeloEstado
                        estado="desconhecido"
                        rotulo="estado desconhecido"
                      />
                    </div>

                    {diagsProj.length > 0 ? (
                      <ul className="space-y-1.5 text-xs">
                        {diagsProj.map((diag, i) => (
                          <li
                            key={`${diag.campo}-${i}`}
                            className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 p-2 rounded bg-stone-950/70 border border-purple-800/50"
                          >
                            <code className="font-mono text-purple-200 font-semibold shrink-0">
                              {diag.campo}
                            </code>
                            <span className="text-stone-200 font-sans">
                              {diag.motivo}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs font-mono text-purple-200">
                        nucleo: null (sem bloco da Sociedade identificado)
                      </p>
                    )}
                  </div>
                );
              })}

              {Array.from(diagnosticosOrfaosPorProjeto.entries()).map(
                ([projId, diags]) => (
                  <div
                    key={projId}
                    className="p-3 rounded border border-purple-500/60 bg-purple-950/40 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3
                        style={RPG_TITLE_STYLE}
                        className="text-sm font-bold uppercase tracking-wide text-purple-100"
                      >
                        {projId}
                      </h3>
                      <SeloEstado
                        estado="desconhecido"
                        rotulo="estado desconhecido"
                      />
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      {diags.map((diag, i) => (
                        <li
                          key={`${diag.campo}-${i}`}
                          className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 p-2 rounded bg-stone-950/70 border border-purple-800/50"
                        >
                          <code className="font-mono text-purple-200 font-semibold shrink-0">
                            {diag.campo}
                          </code>
                          <span className="text-stone-200 font-sans">
                            {diag.motivo}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}

              {diagnosticosGlobais.length > 0 && (
                <div className="p-3 rounded border border-purple-500/50 bg-stone-950/70 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">
                      Diagnósticos Globais do Pacote
                    </span>
                    <SeloEstado
                      estado="desconhecido"
                      rotulo="campo desconhecido"
                    />
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {diagnosticosGlobais.map((diag, i) => (
                      <li
                        key={`${diag.campo}-${i}`}
                        className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2"
                      >
                        <code className="font-mono text-purple-200 font-semibold shrink-0">
                          {diag.campo}
                        </code>
                        <span className="text-stone-200 font-sans">
                          {diag.motivo}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {projetosEmNevoa.length === 0 &&
                diagnosticosOrfaosPorProjeto.size === 0 &&
                diagnosticosGlobais.length === 0 && (
                  <p className="text-xs text-stone-300 font-sans">
                    Nenhum campo desconhecido ou diagnóstico registrado.
                  </p>
                )}
            </div>
          </MolduraPergaminho>

          {/* SEÇÃO III — FORJAS E NÚCLEOS */}
          <MolduraPergaminho
            titulo="III. Forjas e Núcleos"
            subtitulo="Versão da fonte comparada às instalações de ferramentas e núcleos dos projetos"
            selo={
              fonteVersao ? (
                <SeloEstado estado="em_dia" rotulo={`Fonte ${fonteVersao}`} />
              ) : (
                <SeloEstado
                  estado="desconhecido"
                  rotulo="Fonte desconhecida"
                />
              )
            }
          >
            <div className="space-y-4">
              {/* Instalações */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200 mb-2">
                  Forjas (Instalações)
                </h3>
                <ul className="space-y-2">
                  {dados.pacote.instalacoes.map((inst, idx) => {
                    const origemDesconhecida = inst.origem === null;
                    const prefixoInst = `pacote.instalacoes[${idx}]`;
                    const diagsInst = dados.diagnosticos.filter(
                      (d) =>
                        d.projeto == null &&
                        (d.campo === prefixoInst || d.campo.startsWith(`${prefixoInst}.`))
                    );
                    const diagVersao = diagsInst.find((d) => d.campo.endsWith('.versao'));
                    const motivoInst =
                      diagVersao?.motivo ??
                      (diagsInst.length === 1
                        ? diagsInst[0].motivo
                        : diagsInst.length > 1
                          ? `${diagsInst.length} diagnósticos`
                          : undefined);

                    const ver = classificarVersao({
                      versao: inst.versao,
                      fonteVersao,
                      alteracaoLocal: inst.alteracao_local,
                      diagnosticos: diagsInst.length,
                      motivoDiagnostico: motivoInst,
                    });

                    return (
                      <li
                        key={`${inst.ferramenta}-${idx}`}
                        className="p-2.5 rounded border border-amber-900/40 bg-stone-950/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-100 uppercase">
                            {inst.ferramenta}
                          </span>
                          {origemDesconhecida ? (
                            <SeloEstado
                              estado="desconhecido"
                              rotulo="origem desconhecida"
                            />
                          ) : (
                            <span className="font-mono text-stone-400">
                              ({inst.origem})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <SeloEstado
                            estado={ver.estado}
                            rotulo={rotuloVersao(inst.versao, ver)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Núcleos dos projetos */}
              <div className="pt-2 border-t border-amber-900/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-200 mb-2">
                  Núcleos dos Projetos
                </h3>
                <ul className="space-y-2">
                  {dados.projetos.map((proj) => {
                    const nuc = classificarVersao({
                      versao: proj.nucleo,
                      fonteVersao,
                      diagnosticos: dados.diagnosticos.filter(
                        (d) => d.projeto === proj.id
                      ).length,
                    });

                    return (
                      <li
                        key={proj.id}
                        className="p-2.5 rounded border border-amber-900/40 bg-stone-950/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold text-stone-100">
                          {proj.nome}
                        </span>

                        <SeloEstado
                          estado={nuc.estado}
                          rotulo={rotuloVersao(proj.nucleo, nuc)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </MolduraPergaminho>
        </div>

        {/* Coluna Direita (5/12 em >= 1280px): Seção IV — Pergaminho de Abertura */}
        <div className="xl:col-span-5 xl:sticky xl:top-4 min-w-0">
          <PergaminhoAbertura
            projetos={dados.projetos}
            cardapio={dados.cardapio ?? []}
          />
        </div>
      </div>
    </div>
  );
};

export default HojePage;
