import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Cloud, CheckSquare, Square } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { ApiNodeData } from '@/types/graph';

export const ApiNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as ApiNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'api',
      filePath: nodeData.filePath,
      codeSnippet: nodeData.codeSnippet,
    });
  };

  const method = nodeData.apiCall?.method || 'GET';
  const endpoint = nodeData.apiCall?.endpoint || nodeData.label;

  const getMethodColor = (m: string) => {
    switch (m) {
      case 'POST': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PUT':
      case 'PATCH': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DELETE': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const isSearchMatch = Boolean(nodeData.isSearchMatch);
  const isDimmed = Boolean(nodeData.isDimmed);
  const isTB = nodeData.layoutDirection === 'TB';

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border px-3 py-2 shadow-md backdrop-blur-md transition-all duration-200 ${
        isDimmed ? 'opacity-30 grayscale-[50%] hover:opacity-100 hover:grayscale-0' : 'opacity-100'
      } ${
        isSearchMatch
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400 shadow-xl shadow-amber-500/25 scale-[1.02] z-30'
          : selected
          ? 'border-rose-400 bg-rose-950/70 ring-2 ring-rose-500/50 shadow-rose-500/20'
          : checked
          ? 'border-rose-500/80 bg-slate-900/95 ring-1 ring-rose-500/40'
          : 'border-rose-900/60 bg-slate-900/90 hover:border-rose-700/80'
      }`}
      style={{ minWidth: '200px' }}
    >
      <Handle
        type="target"
        position={isTB ? Position.Top : Position.Left}
        className="!w-2.5 !h-2.5 !rounded-full !bg-rose-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />

      {/* Search Match Badge */}
      {isSearchMatch && (
        <span className="absolute -top-2 -right-1.5 px-1 py-0.2 rounded-full bg-amber-400 text-slate-950 font-bold text-[7px] uppercase tracking-wider shadow animate-pulse pointer-events-none">
          Busca
        </span>
      )}

      <button
        onClick={handleCheckboxClick}
        className="text-slate-400 hover:text-rose-300 transition-colors p-0.5"
        title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
      >
        {checked ? (
          <CheckSquare className="h-4 w-4 text-rose-400 fill-rose-500/20" />
        ) : (
          <Square className="h-4 w-4 text-slate-500" />
        )}
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <Cloud className="h-4 w-4 text-rose-400 flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`rounded px-1 text-[9px] font-bold border ${getMethodColor(
                method
              )}`}
            >
              {method}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-slate-400">
              API
            </span>
          </div>
          <span className="text-xs font-mono text-slate-200 truncate block max-w-[150px]" title={endpoint}>
            {endpoint}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={isTB ? Position.Bottom : Position.Right}
        className="!w-2.5 !h-2.5 !rounded-full !bg-rose-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />
    </div>
  );
};
