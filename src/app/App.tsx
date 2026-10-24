import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Link, Routes, Route } from 'react-router-dom';
import { PainelShell } from './PainelShell';
import { EstadoTela } from './rpgTheme';
import { HojePage } from '../painel/hoje/HojePage';
import { ProjetosPage } from '../painel/projetos/ProjetosPage';

// O Analisador traz Babel, React Flow, dagre e JSZip: só carrega quando a rota é aberta,
// e o Conselho e as Regiões abrem sem esse peso.
const AnalisadorPage = lazy(() => import('./AnalisadorPage'));

const CarregandoAnalisador: React.FC = () => (
  <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
    <EstadoTela estado="carregando" titulo="Despertando o Palantír..." mensagem="Carregando o analisador visual." />
  </div>
);

const AnalisadorRoute: React.FC = () => (
  <Suspense fallback={<CarregandoAnalisador />}>
    <AnalisadorPage />
  </Suspense>
);

/** Comportamento do React Router v7, já ligado na v6 (e sem os avisos no console). */
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export const PaginaNaoEncontrada: React.FC = () => (
  <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
    <EstadoTela
      estado="vazio"
      titulo="Caminho fora do mapa"
      mensagem="Esta página não existe no painel."
      acao={
        <Link
          to="/"
          className="inline-flex items-center min-h-[44px] px-4 py-2 rounded border border-amber-700 bg-stone-900 text-amber-100 text-sm font-semibold hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          Voltar ao Conselho
        </Link>
      }
    />
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <PainelShell>
        <Routes>
          <Route path="/" element={<HojePage />} />
          <Route path="/projetos" element={<ProjetosPage />} />
          <Route path="/projetos/:id" element={<ProjetosPage />} />
          <Route path="/analisador" element={<AnalisadorRoute />} />
          <Route path="*" element={<PaginaNaoEncontrada />} />
        </Routes>
      </PainelShell>
    </BrowserRouter>
  );
};

export default App;
