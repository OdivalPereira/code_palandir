import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Code2, CheckSquare, Square } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { HookNodeData } from '@/types/graph';

export const HookNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as HookNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'hook',
      filePath: nodeData.filePath,
      codeSnippet: nodeData.codeSnippet,
    });
  };

  const isSearchMatch = Boolean(nodeData.isSearchMatch);
  const isDimmed = Boolean(nodeData.isDimmed);
  const isTB = nodeData.layoutDirection === 'TB';

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm backdrop-blur-md transition-all duration-200 ${
        isDimmed ? 'opacity-30 grayscale-[50%] hover:opacity-100 hover:grayscale-0' : 'opacity-100'
      } ${
        isSearchMatch
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400 shadow-xl shadow-amber-500/25 scale-[1.02] z-30'
          : selected
          ? 'border-indigo-400 bg-indigo-950/70 ring-2 ring-indigo-500/50 shadow-indigo-500/20'
          : checked
          ? 'border-indigo-500/80 bg-slate-900/95 ring-1 ring-indigo-500/40'
          : 'border-indigo-900/50 bg-slate-900/90 hover:border-indigo-700/80'
      }`}
      style={{ minWidth: '150px' }}
    >
      <Handle
        type="target"
        position={isTB ? Position.Top : Position.Left}
        className="!w-2.5 !h-2.5 !rounded-full !bg-indigo-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />

      {/* Search Match Badge */}
      {isSearchMatch && (
        <span className="absolute -top-2 -right-1.5 px-1 py-0.2 rounded-full bg-amber-400 text-slate-950 font-bold text-[7px] uppercase tracking-wider shadow animate-pulse pointer-events-none">
          Busca
        </span>
      )}

      <button
        onClick={handleCheckboxClick}
        className="text-slate-400 hover:text-indigo-300 transition-colors p-0.5"
        title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
      >
        {checked ? (
          <CheckSquare className="h-3.5 w-3.5 text-indigo-400 fill-indigo-500/20" />
        ) : (
          <Square className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      <div className="flex items-center gap-1.5 min-w-0">
        <Code2 className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400/80 block">
            Hook
          </span>
          <span className="text-[11px] font-mono text-slate-200 truncate block">
            {nodeData.label}()
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={isTB ? Position.Bottom : Position.Right}
        className="!w-2.5 !h-2.5 !rounded-full !bg-indigo-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />
    </div>
  );
};
