import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Database, CheckSquare, Square } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { StoreNodeData } from '@/types/graph';

export const StoreNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as StoreNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'store',
      filePath: nodeData.filePath,
    });
  };

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-md backdrop-blur-md transition-all ${
        selected
          ? 'border-cyan-400 bg-cyan-950/70 ring-2 ring-cyan-500/40'
          : 'border-cyan-900/60 bg-slate-900/90 hover:border-cyan-700/80'
      }`}
      style={{ minWidth: '170px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-400" />

      <button
        onClick={handleCheckboxClick}
        className="text-slate-400 hover:text-cyan-300 transition-colors p-0.5"
        title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
      >
        {checked ? (
          <CheckSquare className="h-3.5 w-3.5 text-cyan-400 fill-cyan-500/20" />
        ) : (
          <Square className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      <div className="flex items-center gap-1.5 min-w-0">
        <Database className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
        <div className="min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/80 block">
            Estado / Store
          </span>
          <span className="text-[11px] font-mono text-slate-100 truncate block">
            {nodeData.label}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-cyan-400" />
    </div>
  );
};
