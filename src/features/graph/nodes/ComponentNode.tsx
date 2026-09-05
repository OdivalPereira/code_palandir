import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, CheckSquare, Square, Zap, FormInput, MousePointerClick } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { ComponentNodeData } from '@/types/graph';

export const ComponentNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as ComponentNodeData;
  const { isSelected, toggleElement } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleElement({
      id: nodeData.id,
      label: nodeData.label,
      nodeType: 'component',
      filePath: nodeData.filePath,
      codeSnippet: nodeData.codeSnippet,
    });
  };

  const comp = nodeData.component;
  const hasButtons = comp?.wireframe?.some(w => w.type === 'button');
  const hasInputs = comp?.wireframe?.some(w => w.type === 'input');

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-3 shadow-lg backdrop-blur-md transition-all ${
        selected
          ? 'border-purple-400 bg-purple-950/70 ring-2 ring-purple-500/40 shadow-purple-500/20'
          : 'border-purple-900/60 bg-slate-900/90 hover:border-purple-700/80'
      }`}
      style={{ minWidth: '240px' }}
    >
      <Handle type="target" position={Position.Left} className="!bg-purple-400" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
            <Box className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400/80 block">
              Componente
            </span>
            <span className="text-xs font-semibold text-slate-100 truncate block">
              &lt;{nodeData.label} /&gt;
            </span>
          </div>
        </div>

        {/* Quick Select Checkbox */}
        <button
          onClick={handleCheckboxClick}
          className="text-slate-400 hover:text-purple-300 transition-colors p-0.5"
          title={checked ? 'Remover do Prompt' : 'Adicionar ao Prompt'}
        >
          {checked ? (
            <CheckSquare className="h-4 w-4 text-purple-400 fill-purple-500/20" />
          ) : (
            <Square className="h-4 w-4 text-slate-500" />
          )}
        </button>
      </div>

      {/* Mini Wireframe Indicators */}
      {(hasButtons || hasInputs || nodeData.actionsCount > 0) && (
        <div className="mt-2 flex items-center gap-1.5 py-1 px-2 rounded-md bg-slate-950/50 border border-slate-800/60 text-[10px] text-slate-400">
          {hasInputs && (
            <span className="flex items-center gap-1 text-slate-300">
              <FormInput className="h-3 w-3 text-slate-400" /> Inputs
            </span>
          )}
          {hasButtons && (
            <span className="flex items-center gap-1 text-indigo-300">
              <MousePointerClick className="h-3 w-3 text-indigo-400" /> Botões
            </span>
          )}
          {nodeData.actionsCount > 0 && (
            <span className="flex items-center gap-1 text-amber-300 ml-auto">
              <Zap className="h-3 w-3 text-amber-400" /> {nodeData.actionsCount} ações
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-400">
        <span className="font-mono truncate max-w-[150px]" title={nodeData.filePath}>
          {nodeData.filePath?.split('/').pop()}
        </span>
        {comp?.childrenNames?.length > 0 && (
          <span className="text-purple-300 font-mono text-[9px]">
            +{comp.childrenNames.length} filhos
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-purple-400" />
    </div>
  );
};
