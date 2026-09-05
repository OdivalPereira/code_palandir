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
    });
  };

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-sm backdrop-blur-md transition-all ${
        selected
          ? 'border-indigo-400 bg-indigo-950/70 ring-2 ring-indigo-500/40'
          : 'border-indigo-900/50 bg-slate-900/90 hover:border-indigo-700/80'
      }`}
      style={{ minWidth: '150px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-400" />

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

      <Handle type="source" position={Position.Right} className="!bg-indigo-400" />
    </div>
  );
};
