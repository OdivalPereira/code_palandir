import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IntentPanel } from './components/IntentPanel';
import { TemplateSidebar } from './components/TemplateSidebar';
import { TemplateWizard } from './components/TemplateWizard';
import AppTopBar from './components/AppTopBar';
import AppVisualization from './components/AppVisualization';
import PromptSidebarPanel from './components/PromptSidebarPanel';
import AppEffects from './components/AppEffects';

const App: React.FC = () => (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
        <TemplateSidebar className="w-64" />

        <div className="flex-1 flex flex-col relative">
            <AppTopBar />
            <AppVisualization />
        </div>

        <IntentPanel className="w-80" />
        <PromptSidebarPanel />
        <ErrorBoundary name="TemplateWizard">
            <TemplateWizard />
        </ErrorBoundary>
        <AppEffects />
    </div>
);

export default App;
