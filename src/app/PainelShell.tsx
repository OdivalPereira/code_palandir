import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RPG_TITLE_STYLE, SeloEstado } from './rpgTheme';
import { usePainelStore } from '@/stores/painelStore';
import { formatarColetadoEm } from '@/painel/formatacao';

export interface PainelShellProps {
  children: React.ReactNode;
}

/** Nome da tela pela rota: título da aba do navegador e anúncio da troca de tela. */
export function tituloDaRota(pathname: string): string {
  if (pathname === '/') return 'O Conselho';
  if (pathname === '/projetos' || pathname.startsWith('/projetos/')) return 'Regiões';
  if (pathname.startsWith('/analisador')) return 'Palantír — Analisador';
  return 'Caminho fora do mapa';
}

export const PainelShell: React.FC<PainelShellProps> = ({ children }) => {
  const dados = usePainelStore((s) => s.dados);
  const location = useLocation();
  const currentPath = location.pathname;
  const mainRef = useRef<HTMLElement>(null);
  const secaoAnterior = useRef<string | null>(null);

  // Troca de tela: título da aba e foco no conteúdo (só quando muda a seção, não a região).
  useEffect(() => {
    document.title = `${tituloDaRota(currentPath)} · Code Palandir`;
    const secao = currentPath.split('/')[1] ?? '';
    if (secaoAnterior.current !== null && secaoAnterior.current !== secao) {
      mainRef.current?.focus({ preventScroll: true });
    }
    secaoAnterior.current = secao;
  }, [currentPath]);

  const isAnalisador = currentPath.startsWith('/analisador');
  const isConselho = currentPath === '/';
  const isProjetos = currentPath.startsWith('/projetos');

  return (
    <div className="h-screen h-dvh w-screen overflow-hidden flex flex-col bg-stone-950 text-stone-200 font-sans">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 min-h-[44px] focus:inline-flex focus:items-center focus:px-3 focus:rounded bg-stone-900 text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        Pular para o conteúdo
      </a>
      {/* ===================================================================
          TOPO (HEADER >= 52px)
          =================================================================== */}
      <header className="min-h-[52px] h-[52px] flex-shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-amber-900/60 bg-stone-900/95 z-20">
        {/* Esquerda: Emblema do Palantír + Título e Máquina */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Emblema SVG do Palantír Dourado */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-950 border border-amber-500/80 flex items-center justify-center shadow-inner"
            title="Palantír — Pedra Vidente"
            aria-hidden="true"
          >
            <svg
              className="w-5 h-5 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
              <ellipse cx="12" cy="12" rx="9" ry="3.5" stroke="currentColor" strokeWidth="1" className="opacity-70" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span
                style={RPG_TITLE_STYLE}
                className="text-amber-100 font-bold uppercase tracking-wider text-sm sm:text-base truncate"
              >
                Code Palandir
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400 font-mono leading-none min-w-0">
              {dados ? (
                <>
                  <span className="truncate" title={`Máquina: ${dados.maquina}`}>
                    {dados.maquina}
                  </span>
                  <span className="text-stone-400" aria-hidden="true">
                    •
                  </span>
                  <time
                    dateTime={dados.coletado_em}
                    title={`Coletado em ${dados.coletado_em}`}
                    className="flex-shrink-0"
                  >
                    {formatarColetadoEm(dados.coletado_em)}
                  </time>
                </>
              ) : (
                <span className="truncate">sem instantâneo</span>
              )}
            </div>
          </div>
        </div>

        {/* Direita: Selo de Dados de Exemplo (Fase A) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SeloEstado estado="atencao" rotulo="Dados de exemplo" />
        </div>
      </header>

      {/* ===================================================================
          CORPO: BARRA LATERAL (>=1280px) + ÁREA PRINCIPAL
          =================================================================== */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-row overflow-hidden relative">
        {/* Barra Lateral Fixa para Telas Largas (>= 1280px, xl:w-60) */}
        <aside
          aria-label="Navegação Principal"
          className="hidden xl:flex xl:w-60 xl:flex-col flex-shrink-0 border-r border-amber-900/60 bg-stone-900/75 p-3 overflow-y-auto"
        >
          <div className="space-y-6">
            {/* Seção 1: Jornada Principal */}
            <div>
              <div className="px-2 mb-2 text-[10px] font-mono uppercase tracking-wider text-amber-500/80 font-bold">
                Jornada do Código
              </div>
              <nav className="space-y-1">
                {/* 1. O Conselho (Hoje) */}
                <Link
                  to="/"
                  className={`min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isConselho
                      ? 'bg-amber-950/80 border border-amber-500/80 text-amber-100 shadow-sm'
                      : 'border border-transparent text-stone-300 hover:bg-stone-800/80 hover:text-stone-100'
                  }`}
                  aria-current={isConselho ? 'page' : undefined}
                >
                  <span className="text-base select-none" aria-hidden="true">
                    👑
                  </span>
                  <div className="flex flex-col">
                    <span style={RPG_TITLE_STYLE} className="font-semibold text-xs tracking-wide">
                      O Conselho
                    </span>
                    <span className="text-[10px] text-stone-400 font-sans">Hoje & Visão Geral</span>
                  </div>
                </Link>

                {/* 2. Regiões (Projetos) */}
                <Link
                  to="/projetos"
                  className={`min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isProjetos
                      ? 'bg-amber-950/80 border border-amber-500/80 text-amber-100 shadow-sm'
                      : 'border border-transparent text-stone-300 hover:bg-stone-800/80 hover:text-stone-100'
                  }`}
                  aria-current={isProjetos ? 'page' : undefined}
                >
                  <span className="text-base select-none" aria-hidden="true">
                    🗺️
                  </span>
                  <div className="flex flex-col">
                    <span style={RPG_TITLE_STYLE} className="font-semibold text-xs tracking-wide">
                      Regiões
                    </span>
                    <span className="text-[10px] text-stone-400 font-sans">Mapa & Projetos</span>
                  </div>
                </Link>

                {/* 3. Palantír (Analisador) */}
                <Link
                  to="/analisador"
                  className={`min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isAnalisador
                      ? 'bg-amber-950/80 border border-amber-500/80 text-amber-100 shadow-sm'
                      : 'border border-transparent text-stone-300 hover:bg-stone-800/80 hover:text-stone-100'
                  }`}
                  aria-current={isAnalisador ? 'page' : undefined}
                >
                  <span className="text-base select-none" aria-hidden="true">
                    🔮
                  </span>
                  <div className="flex flex-col">
                    <span style={RPG_TITLE_STYLE} className="font-semibold text-xs tracking-wide">
                      Palantír
                    </span>
                    <span className="text-[10px] text-stone-400 font-sans">Analisador Visual</span>
                  </div>
                </Link>

                {/* 4. Sociedade (Cartas — Reservado Fase B · p3) */}
                <div
                  aria-disabled="true"
                  className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md text-sm border border-stone-800/60 bg-stone-950/40 text-stone-400 cursor-not-allowed select-none"
                  title="Reservado para Fase B · p3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base opacity-50" aria-hidden="true">
                      🃏
                    </span>
                    <div className="flex flex-col">
                      <span className="font-serif text-xs tracking-wide font-medium">
                        Sociedade
                      </span>
                      <span className="text-[10px] text-stone-400 font-sans">Cartas dos Agentes</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono uppercase whitespace-nowrap px-1.5 py-0.5 rounded border border-amber-900/60 bg-stone-900 text-amber-400/80">
                    Fase B · p3
                  </span>
                </div>
              </nav>
            </div>

            {/* Seção 2: Centro de Comando (Reservado Fase B · p3) */}
            <div>
              <div className="px-2 mb-2 text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold">
                Centro de Comando
              </div>
              <div className="space-y-1">
                {/* Tarefa nova */}
                <div
                  aria-disabled="true"
                  className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md text-xs border border-stone-800/60 bg-stone-950/40 text-stone-400 cursor-not-allowed select-none"
                  title="Reservado para Fase B · p3"
                >
                  <div className="flex items-center gap-2">
                    <span className="opacity-50" aria-hidden="true">
                      ⚔️
                    </span>
                    <span>Tarefa nova</span>
                  </div>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded border border-amber-900/60 text-amber-500/70">
                    Fase B · p3
                  </span>
                </div>

                {/* Perguntas */}
                <div
                  aria-disabled="true"
                  className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md text-xs border border-stone-800/60 bg-stone-950/40 text-stone-400 cursor-not-allowed select-none"
                  title="Reservado para Fase B · p3"
                >
                  <div className="flex items-center gap-2">
                    <span className="opacity-50" aria-hidden="true">
                      📜
                    </span>
                    <span>Perguntas</span>
                  </div>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded border border-amber-900/60 text-amber-500/70">
                    Fase B · p3
                  </span>
                </div>

                {/* Conversa */}
                <div
                  aria-disabled="true"
                  className="min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md text-xs border border-stone-800/60 bg-stone-950/40 text-stone-400 cursor-not-allowed select-none"
                  title="Reservado para Fase B · p3"
                >
                  <div className="flex items-center gap-2">
                    <span className="opacity-50" aria-hidden="true">
                      💬
                    </span>
                    <span>Conversa</span>
                  </div>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded border border-amber-900/60 text-amber-500/70">
                    Fase B · p3
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Conteúdo Principal (<main>) */}
        <main
          id="conteudo"
          ref={mainRef}
          tabIndex={-1}
          aria-label={tituloDaRota(currentPath)}
          className={
            isAnalisador
              ? 'flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden relative focus:outline-none'
              : 'flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 xl:p-6 focus:outline-none'
          }
        >
          {children}
        </main>
      </div>

      {/* ===================================================================
          BARRA INFERIOR MOBILE (< 1280px / 360px, min-h-[56px])
          =================================================================== */}
      <nav
        aria-label="Navegação Móvel"
        className="xl:hidden min-h-[56px] h-[56px] flex-shrink-0 flex items-center justify-around px-1 border-t border-amber-900/60 bg-stone-900/95 z-20"
      >
        {/* 1. Conselho */}
        <Link
          to="/"
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center px-2 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            isConselho
              ? 'text-amber-300 font-bold bg-amber-950/50'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          aria-current={isConselho ? 'page' : undefined}
          title="O Conselho (Hoje)"
        >
          <span className="text-base select-none" aria-hidden="true">
            👑
          </span>
          <span className="text-[10px] tracking-tight">Conselho</span>
        </Link>

        {/* 2. Regiões */}
        <Link
          to="/projetos"
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center px-2 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            isProjetos
              ? 'text-amber-300 font-bold bg-amber-950/50'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          aria-current={isProjetos ? 'page' : undefined}
          title="Regiões (Projetos)"
        >
          <span className="text-base select-none" aria-hidden="true">
            🗺️
          </span>
          <span className="text-[10px] tracking-tight">Regiões</span>
        </Link>

        {/* 3. Palantír */}
        <Link
          to="/analisador"
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center px-2 py-1 rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            isAnalisador
              ? 'text-amber-300 font-bold bg-amber-950/50'
              : 'text-stone-400 hover:text-stone-200'
          }`}
          aria-current={isAnalisador ? 'page' : undefined}
          title="Palantír (Analisador)"
        >
          <span className="text-base select-none" aria-hidden="true">
            🔮
          </span>
          <span className="text-[10px] tracking-tight">Palantír</span>
        </Link>

        {/* 4. Sociedade (Reservado) */}
        <div
          aria-disabled="true"
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center px-2 py-1 text-stone-400 cursor-not-allowed select-none"
          title="Sociedade (Cartas) — Fase B · p3"
        >
          <span className="text-base opacity-40 select-none" aria-hidden="true">
            🃏
          </span>
          <span className="text-[10px] tracking-tight">Sociedade</span>
          <span className="sr-only">(reservado para a fase B, p3)</span>
        </div>
      </nav>
    </div>
  );
};

export default PainelShell;
