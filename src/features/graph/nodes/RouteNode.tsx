import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Globe, CheckSquare, Square } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { RouteNodeData } from '@/types/graph';

export const RouteNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as RouteNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'route',
      filePath: nodeData.filePath,
      codeSnippet: nodeData.codeSnippet,
    });
  };

  const isSearchMatch = Boolean(nodeData.isSearchMatch);
  const isDimmed = Boolean(nodeData.isDimmed);
  const isTB = nodeData.layoutDirection === 'TB';

  return (
    <div
      className={`group relative flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur-md transition-all duration-200 ${
        isDimmed ? 'opacity-30 grayscale-[50%] hover:opacity-100 hover:grayscale-0' : 'opacity-100'
      } ${
        isSearchMatch
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400 shadow-xl shadow-amber-500/25 scale-[1.02] z-30'
          : selected
          ? 'border-blue-400 bg-blue-950/70 ring-2 ring-blue-500/50 shadow-blue-500/20'
          : checked
          ? 'border-blue-500/80 bg-slate-900/95 ring-1 ring-blue-500/40'
          : 'border-blue-900/60 bg-slate-900/90 hover:border-blue-700/80'
      }`}
      style={{ minWidth: '180px' }}
    >
      <Handle
        type="target"
        position={isTB ? Position.Top : Position.Left}
        className="!w-3 !h-3 !rounded-full !bg-blue-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />

      {/* Search Match Badge */}
      {isSearchMatch && (
        <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[8px] uppercase tracking-wider shadow animate-pulse pointer-events-none">
          Busca
        </span>
      )}

      {/* Quick Select Checkbox */}
      <button
        onClick={handleCheckboxClick}
        className="text-slate-400 hover:text-blue-300 transition-colors p-0.5"
        title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
      >
        {checked ? (
          <CheckSquare className="h-4 w-4 text-blue-400 fill-blue-500/20" />
        ) : (
          <Square className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {/* Icon & Label */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 flex-shrink-0">
          <Globe className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80 block">
            Rota
          </span>
          <span className="text-xs font-semibold text-slate-100 truncate block font-mono">
            {nodeData.label}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={isTB ? Position.Bottom : Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-blue-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />
    </div>
  );
};
