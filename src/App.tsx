import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppTopBar from './components/AppTopBar';
import AppVisualization from './components/AppVisualization';
import VisualSurfacePanel from './components/VisualSurfacePanel';
import PromptStudioPanel from './components/PromptStudioPanel';
import GitHubImportModal from './components/GitHubImportModal';
import { TemplateWizard } from './components/TemplateWizard';
import AppEffects from './components/AppEffects';

const App: React.FC = () => (
  <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
    {/* Panel 1: Visual Surface (Rotas, Telas e Componentes) */}
    <ErrorBoundary name="VisualSurfacePanel">
      <VisualSurfacePanel className="w-80 flex-shrink-0" />
    </ErrorBoundary>

    {/* Center Area: TopBar + Panel 2 (Palantír Lens / Trilha de Execução) */}
    <div className="flex-1 flex flex-col min-w-0 relative">
      <AppTopBar />
      <AppVisualization />
    </div>

    {/* Panel 3: Context Basket & Prompt Studio */}
    <ErrorBoundary name="PromptStudioPanel">
      <PromptStudioPanel className="w-96 flex-shrink-0" />
    </ErrorBoundary>

    {/* Overlays & Modals */}
    <GitHubImportModal />
    <ErrorBoundary name="TemplateWizard">
      <TemplateWizard />
    </ErrorBoundary>
    <AppEffects />
  </div>
);

export default App;
