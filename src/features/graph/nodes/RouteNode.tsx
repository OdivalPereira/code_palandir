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
    });
  };

  return (
    <div
      className={`group relative flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg backdrop-blur-md transition-all ${
        selected
          ? 'border-blue-400 bg-blue-950/70 ring-2 ring-blue-500/40 shadow-blue-500/20'
          : 'border-blue-900/60 bg-slate-900/90 hover:border-blue-700/80'
      }`}
      style={{ minWidth: '180px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-blue-400" />

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
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
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

      <Handle type="source" position={Position.Right} className="!bg-blue-400" />
    </div>
  );
};
