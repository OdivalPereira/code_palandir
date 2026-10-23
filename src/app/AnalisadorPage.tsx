import React from 'react';
import { TopBar } from './TopBar';
import { GraphCanvas } from '@/features/graph/GraphCanvas';
import { DetailSidebar } from '@/features/detail/DetailSidebar';
import { PromptBuilder } from '@/features/prompt/PromptBuilder';
import { ForensicsPanel } from '@/features/detail/ForensicsPanel';
import { ImportDialog } from '@/features/import/ImportDialog';
import { useUIStore } from '@/stores/uiStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { Info, Sparkles, ShieldAlert } from 'lucide-react';

export const AnalisadorPage: React.FC = () => {
  const { sidebarOpen, activeSidebarTab, setSidebarTab } = useUIStore();
  const selectedElements = useSelectionStore((state) => state.selectedElements);

  return (
    <div className="flex flex-col h-full w-full flex-1 min-h-0 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* TopBar */}
      <TopBar />

      {/* Main Content: 2-Panel Layout */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Canvas: Flow Graph */}
        <main className="flex-1 h-full min-w-0 relative">
          <GraphCanvas />
        </main>

        {/* Collapsible Right Sidebar */}
        {sidebarOpen && (
          <aside className="w-96 flex-shrink-0 h-full border-l border-slate-800 bg-slate-950/95 flex flex-col z-10 shadow-2xl backdrop-blur-md">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/50 p-1 gap-1">
              <button
                onClick={() => setSidebarTab('detail')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeSidebarTab === 'detail'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Detalhes do Nó Selecionado"
              >
                <Info className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Detalhes</span>
              </button>

              <button
                onClick={() => setSidebarTab('prompt')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeSidebarTab === 'prompt'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Gerador de Prompt para IA"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span className="hidden sm:inline">Prompt</span>
                {selectedElements.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white text-indigo-900 px-1 text-[9px] font-bold">
                    {selectedElements.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setSidebarTab('forensics')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeSidebarTab === 'forensics'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Auditoria Forense & Saúde Arquitetural"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Auditoria</span>
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-hidden">
              {activeSidebarTab === 'detail' ? (
                <DetailSidebar />
              ) : activeSidebarTab === 'prompt' ? (
                <PromptBuilder />
              ) : (
                <ForensicsPanel />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modals & Dialogs */}
      <ImportDialog />
    </div>
  );
};

export default AnalisadorPage;
