import React from 'react';
import {
  FolderOpen,
  Search,
  ArrowDownUp,
  Layers,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useGraphStore } from '@/stores/graphStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { Input } from '@/ui/Input';

export const TopBar: React.FC = () => {
  const meta = useProjectStore((state) => state.meta);
  const analysis = useProjectStore((state) => state.analysis);
  const { filters, setFilters, toggleLayoutDirection, layoutDirection } = useGraphStore();
  const selectedElements = useSelectionStore((state) => state.selectedElements);
  const { sidebarOpen, toggleSidebar, setSidebarTab, setImportModalOpen } = useUIStore();

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 backdrop-blur-md z-20">
      {/* Left: Branding & Project Meta */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <Layers className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
            Code Palandir <span className="text-indigo-400 text-xs font-semibold">v2</span>
          </span>
        </div>

        {meta && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-xs font-medium text-slate-200 truncate max-w-[160px]">
              {meta.name}
            </span>
            <Badge variant="purple" className="text-[10px] uppercase font-bold">
              {meta.framework}
            </Badge>
            {analysis && (
              <span className="text-[11px] text-slate-400 hidden xl:inline">
                ({analysis.routes.length} rotas, {analysis.pages.length} telas, {analysis.components.length} componentes)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Search & View Filters */}
      {meta && (
        <div className="flex items-center gap-2 max-w-md w-full mx-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <Input
              type="text"
              placeholder="Buscar nós (rotas, botões, ações)..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              className="h-8 pl-8 text-xs bg-slate-900/60 border-slate-800"
            />
          </div>

          {/* Quick Filters */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilters({ showActions: !filters.showActions })}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                filters.showActions
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Alternar nós de Ações e Botões"
            >
              Ações
            </button>
            <button
              onClick={() => setFilters({ showApis: !filters.showApis })}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                filters.showApis
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Alternar nós de APIs"
            >
              APIs
            </button>
            <button
              onClick={() => setFilters({ showStores: !filters.showStores })}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                filters.showStores
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Alternar nós de Stores e Estados"
            >
              Stores
            </button>
          </div>

          {/* Layout Direction Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLayoutDirection}
            className="h-8 px-2 text-xs text-slate-400 hover:text-slate-200"
            title={`Alternar Orientação do Grafo (Atual: ${layoutDirection})`}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Right: Connect Project & Prompt Basket Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportModalOpen(true)}
          className="h-8 gap-1.5 text-xs text-slate-200 border-slate-700 bg-slate-900 hover:bg-slate-800"
        >
          <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Conectar Projeto</span>
        </Button>

        {/* Prompt Basket Quick Action */}
        <Button
          size="sm"
          onClick={() => setSidebarTab('prompt')}
          className={`h-8 gap-1.5 text-xs font-semibold shadow-md transition-all ${
            selectedElements.length > 0
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span className="hidden sm:inline">Prompt IA</span>
          {selectedElements.length > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white text-indigo-900 px-1 text-[10px] font-bold">
              {selectedElements.length}
            </span>
          )}
        </Button>

        {/* Toggle Sidebar */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 text-slate-400 hover:text-slate-200"
          title={sidebarOpen ? 'Ocultar Painel Lateral' : 'Abrir Painel Lateral'}
        >
          {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
};
