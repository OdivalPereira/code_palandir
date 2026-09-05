import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap, CheckSquare, Square } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { ActionNodeData } from '@/types/graph';

export const ActionNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as ActionNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'action',
      filePath: nodeData.filePath,
      codeSnippet: nodeData.codeSnippet,
    });
  };

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-md backdrop-blur-md transition-all ${
        selected
          ? 'border-amber-400 bg-amber-950/70 ring-2 ring-amber-500/40 shadow-amber-500/20'
          : 'border-amber-900/60 bg-slate-900/90 hover:border-amber-700/80'
      }`}
      style={{ minWidth: '170px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-400" />

      {/* Quick Select Checkbox */}
      <button
        onClick={handleCheckboxClick}
        className="text-slate-400 hover:text-amber-300 transition-colors p-0.5"
        title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
      >
        {checked ? (
          <CheckSquare className="h-3.5 w-3.5 text-amber-400 fill-amber-500/20" />
        ) : (
          <Square className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      <div className="flex items-center gap-1.5 min-w-0">
        <Zap className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80 block">
            {nodeData.action?.trigger || 'Ação'}
          </span>
          <span className="text-[11px] font-semibold text-slate-100 truncate block font-mono">
            {nodeData.action?.name || nodeData.label}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-amber-400" />
    </div>
  );
};
