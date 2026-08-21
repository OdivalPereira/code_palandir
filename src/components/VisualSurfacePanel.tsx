import React, { useState } from 'react';
import {
  Layout,
  Globe,
  Layers,
  Search,
  ChevronRight,
  ChevronDown,
  Sparkles,
  MousePointerClick,
  ExternalLink,
  Square,
  FormInput,
  FolderGit2,
  RefreshCw
} from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import {
  selectRoutesAndPages,
  selectSelectedUiElementId,
  selectVisualSurfaceMode,
  selectPreviewUrl
} from '../stores/graphSelectors';

interface VisualSurfacePanelProps {
  className?: string;
}

export const VisualSurfacePanel: React.FC<VisualSurfacePanelProps> = ({ className = '' }) => {
  const routesAndPages = useGraphStore(selectRoutesAndPages);
  const selectedUiElementId = useGraphStore(selectSelectedUiElementId);
  const visualSurfaceMode = useGraphStore(selectVisualSurfaceMode);
  const previewUrl = useGraphStore(selectPreviewUrl);

  const inspectComponentTrail = useGraphStore((state) => state.inspectComponentTrail);
  const setVisualSurfaceMode = useGraphStore((state) => state.setVisualSurfaceMode);
  const setPreviewUrl = useGraphStore((state) => state.setPreviewUrl);
  const refreshRoutesAndPages = useGraphStore((state) => state.refreshRoutesAndPages);
  const setImportModalOpen = useGraphStore((state) => state.setImportModalOpen);

  const [searchFilter, setSearchFilter] = useState('');
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [previewInput, setPreviewInput] = useState(previewUrl || '');

  const togglePageExpand = (pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleSelectComponent = (path: string) => {
    inspectComponentTrail(path);
  };

  const handleSavePreviewUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (previewInput.trim()) {
      setPreviewUrl(previewInput.trim());
    }
  };

  const filteredPages = routesAndPages.filter((page) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      page.name.toLowerCase().includes(q) ||
      page.route.toLowerCase().includes(q) ||
      page.components.some((c) => c.name.toLowerCase().includes(q))
    );
  });

  const getComponentIcon = (type: string) => {
    switch (type) {
      case 'button':
        return <MousePointerClick size={13} className="text-amber-400" />;
      case 'form':
        return <FormInput size={13} className="text-emerald-400" />;
      case 'modal':
        return <Square size={13} className="text-indigo-400" />;
      default:
        return <Layers size={13} className="text-sky-400" />;
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900/95 border-r border-slate-800 text-slate-200 ${className}`}>
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-800 space-y-3 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Layout size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                1. Superfície Visual
              </h2>
              <p className="text-[10px] text-slate-400">Rotas, Páginas e Componentes</p>
            </div>
          </div>

          <button
            onClick={refreshRoutesAndPages}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Recarregar árvore visual"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Surface Mode Switcher */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setVisualSurfaceMode('hierarchy')}
            className={`flex-1 py-1 rounded-md flex items-center justify-center gap-1.5 font-medium transition-colors ${
              visualSurfaceMode === 'hierarchy'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers size={12} />
            Árvore de Telas
          </button>
          <button
            onClick={() => setVisualSurfaceMode('preview')}
            className={`flex-1 py-1 rounded-md flex items-center justify-center gap-1.5 font-medium transition-colors ${
              visualSurfaceMode === 'preview'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe size={12} />
            Live Preview
          </button>
        </div>
      </div>

      {/* Surface Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visualSurfaceMode === 'hierarchy' ? (
          <div className="space-y-3">
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-500" size={13} />
              <input
                type="text"
                placeholder="Filtrar páginas e botões..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600"
              />
            </div>

            {routesAndPages.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-xl space-y-3">
                <FolderGit2 size={28} className="mx-auto text-slate-600 opacity-50" />
                <p className="text-xs text-slate-400">Nenhuma tela ou componente detectado.</p>
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 mx-auto"
                >
                  <Sparkles size={12} />
                  <span>Importar Repositório</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPages.map((page) => {
                  const isExpanded = expandedPages.has(page.id) || searchFilter.trim().length > 0;
                  const isSelected = selectedUiElementId === `ui:${page.path}`;

                  return (
                    <div
                      key={page.id}
                      className="border border-slate-800/80 hover:border-slate-700 bg-slate-950/60 rounded-xl overflow-hidden transition-all"
                    >
                      {/* Page Header */}
                      <div
                        onClick={() => {
                          togglePageExpand(page.id);
                          handleSelectComponent(page.path);
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-600/20 border-l-2 border-indigo-500'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePageExpand(page.id);
                            }}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-slate-100 truncate">
                                {page.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-indigo-300 rounded border border-slate-700">
                                {page.route}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono truncate block">
                              {page.path}
                            </span>
                          </div>
                        </div>

                        {page.components.length > 0 && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono flex-shrink-0">
                            {page.components.length}
                          </span>
                        )}
                      </div>

                      {/* Nested Interactive Components List */}
                      {isExpanded && page.components.length > 0 && (
                        <div className="p-1.5 pt-0 space-y-1 bg-slate-900/40 border-t border-slate-800/50">
                          {page.components.map((comp) => {
                            const isCompSelected = selectedUiElementId === `ui:${comp.path}`;
                            return (
                              <button
                                key={comp.id}
                                onClick={() => handleSelectComponent(comp.path)}
                                className={`w-full text-left p-1.5 pl-4 rounded-lg text-xs flex items-center justify-between transition-all ${
                                  isCompSelected
                                    ? 'bg-indigo-600/30 text-white font-medium border border-indigo-500/40'
                                    : 'hover:bg-slate-800/60 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {getComponentIcon(comp.type)}
                                  <span className="truncate">{comp.name}</span>
                                </div>

                                <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 bg-slate-800/90 text-slate-400 rounded">
                                  {comp.type}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Live Preview Mode */
          <div className="h-full flex flex-col space-y-3">
            <form onSubmit={handleSavePreviewUrl} className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">URL do Live Preview</label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="http://localhost:5173 ou https://..."
                  value={previewInput}
                  onChange={(e) => setPreviewInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Conectar
                </button>
              </div>
            </form>

            {previewUrl ? (
              <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden relative flex flex-col">
                <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">{previewUrl}</span>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-slate-200 p-0.5"
                    title="Abrir em nova aba"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                <iframe
                  src={previewUrl}
                  title="App Live Preview"
                  className="w-full flex-1 border-none bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                />
                <div className="p-2 bg-slate-900/90 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                  <span className="truncate">
                    Se o site bloquear o preview (Código 11 / Bot Checkpoint):
                  </span>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 ml-2 flex-shrink-0"
                  >
                    <span>Abrir em Nova Aba</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-500 text-xs">
                <Globe size={28} className="opacity-40" />
                <p>Nenhuma URL de preview conectada.</p>
                <p className="text-[11px] text-slate-600">
                  Insira o endereço do seu localhost ou deploy na Vercel para inspecionar visualmente.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualSurfacePanel;
