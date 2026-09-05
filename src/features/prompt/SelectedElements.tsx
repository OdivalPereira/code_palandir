import React from 'react';
import { X, Layers, Box, Zap, Globe, FileCode, Database, Cloud } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import { Button } from '@/ui/Button';
import type { UINodeType } from '@/types/graph';

export const SelectedElements: React.FC = () => {
  const { selectedElements, removeElement, clearSelection } = useSelectionStore();

  if (selectedElements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center">
        <Layers className="mx-auto h-6 w-6 text-slate-600 mb-1" />
        <p className="text-xs text-slate-400 font-medium">Nenhum elemento selecionado</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Selecione rotas, páginas, botões ou ações no grafo para incluí-los no contexto do prompt.
        </p>
      </div>
    );
  }

  const getNodeIcon = (type: UINodeType) => {
    switch (type) {
      case 'route': return <Globe className="h-3 w-3 text-blue-400" />;
      case 'page': return <FileCode className="h-3 w-3 text-emerald-400" />;
      case 'component': return <Box className="h-3 w-3 text-purple-400" />;
      case 'action': return <Zap className="h-3 w-3 text-amber-400" />;
      case 'store': return <Database className="h-3 w-3 text-cyan-400" />;
      case 'api': return <Cloud className="h-3 w-3 text-rose-400" />;
      default: return <Layers className="h-3 w-3 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Elementos no Contexto ({selectedElements.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          className="h-6 px-2 text-[11px] text-slate-400 hover:text-rose-400"
        >
          Limpar todos
        </Button>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {selectedElements.map((el) => (
          <div
            key={el.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              {getNodeIcon(el.nodeType)}
              <span className="font-medium truncate">{el.label}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {el.nodeType}
              </span>
            </div>
            <button
              onClick={() => removeElement(el.id)}
              className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
              title="Remover do prompt"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
