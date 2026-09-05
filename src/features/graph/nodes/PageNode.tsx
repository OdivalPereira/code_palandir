import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileCode, CheckSquare, Square, Layers } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { PageNodeData } from '@/types/graph';

export const PageNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as PageNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'page',
      filePath: nodeData.filePath,
      codeSnippet: nodeData.codeSnippet,
    });
  };

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-3 shadow-lg backdrop-blur-md transition-all ${
        selected
          ? 'border-emerald-400 bg-emerald-950/70 ring-2 ring-emerald-500/40 shadow-emerald-500/20'
          : 'border-emerald-900/60 bg-slate-900/90 hover:border-emerald-700/80'
      }`}
      style={{ minWidth: '220px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-emerald-400" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <FileCode className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 block">
              Tela / Página
            </span>
            <span className="text-xs font-semibold text-slate-100 truncate block">
              {nodeData.label}
            </span>
          </div>
        </div>

        {/* Quick Select Checkbox */}
        <button
          onClick={handleCheckboxClick}
          className="text-slate-400 hover:text-emerald-300 transition-colors p-0.5"
          title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
        >
          {checked ? (
            <CheckSquare className="h-4 w-4 text-emerald-400 fill-emerald-500/20" />
          ) : (
            <Square className="h-4 w-4 text-slate-500" />
          )}
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1 font-mono truncate max-w-[140px]" title={nodeData.filePath}>
          {nodeData.filePath?.split('/').pop()}
        </span>
        {nodeData.childrenCount > 0 && (
          <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
            <Layers className="h-3 w-3" />
            {nodeData.childrenCount} componentes
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-emerald-400" />
    </div>
  );
};
