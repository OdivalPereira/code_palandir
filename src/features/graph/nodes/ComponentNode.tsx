import React, { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, CheckSquare, Square, Zap, FormInput, MousePointerClick, CheckCheck, CreditCard } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import type { ComponentNodeData } from '@/types/graph';
import type { SelectedElement } from '@/types/prompt';

export const ComponentNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as ComponentNodeData;
  const { isSelected, toggleElement, toggleGroup, isGroupSelected } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  const comp = nodeData.component;

  // Collect all elements belonging to this component (itself, actions, apis, stores)
  const groupElements = useMemo<SelectedElement[]>(() => {
    const elements: SelectedElement[] = [
      {
        id: nodeData.id,
        label: nodeData.label,
        nodeType: 'component',
        filePath: nodeData.filePath,
        codeSnippet: nodeData.codeSnippet,
      },
    ];

    if (comp?.actions) {
      for (const act of comp.actions) {
        elements.push({
          id: `node-action-${act.id}`,
          label: `${act.trigger}: ${act.name}`,
          nodeType: 'action',
          filePath: act.filePath,
          codeSnippet: act.codeSnippet,
        });
      }
    }

    if (comp?.apiCalls) {
      for (const api of comp.apiCalls) {
        elements.push({
          id: `node-api-${api.id}`,
          label: `${api.method} ${api.endpoint}`,
          nodeType: 'api',
          filePath: api.filePath,
          codeSnippet: `// API ${api.method} ${api.endpoint}\n${api.client || 'fetch'}('${api.endpoint}', { method: '${api.method}' });`,
        });
      }
    }

    if (comp?.stores) {
      for (const store of comp.stores) {
        elements.push({
          id: `node-store-${store.id}`,
          label: store.storeName,
          nodeType: 'store',
          codeSnippet: `// Store ${store.storeName}\nconst ${store.storeName} = use${store.storeName}();`,
        });
      }
    }

    return elements;
  }, [nodeData, comp]);

  const groupIds = useMemo(() => groupElements.map((e) => e.id), [groupElements]);
  const allGroupSelected = isGroupSelected(groupIds);
  const isPartiallySelected = useSelectionStore((s) => s.isGroupPartiallySelected(groupIds));

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

  const handleSelectAllGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleGroup(groupElements);
  };

  const hasButtons = comp?.wireframe?.some((w) => w.type === 'button');
  const hasInputs = comp?.wireframe?.some((w) => w.type === 'input');
  const hasCards = comp?.wireframe?.some((w) => w.type === 'card');

  const isSearchMatch = Boolean(nodeData.isSearchMatch);
  const isDimmed = Boolean(nodeData.isDimmed);
  const isTB = nodeData.layoutDirection === 'TB';

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-3 shadow-lg backdrop-blur-md transition-all duration-200 ${
        isDimmed ? 'opacity-30 grayscale-[50%] hover:opacity-100 hover:grayscale-0' : 'opacity-100'
      } ${
        isSearchMatch
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400 shadow-xl shadow-amber-500/25 scale-[1.02] z-30'
          : selected
          ? 'border-purple-400 bg-purple-950/70 ring-2 ring-purple-500/50 shadow-purple-500/20'
          : checked
          ? 'border-purple-500/80 bg-slate-900/95 ring-1 ring-purple-500/40'
          : 'border-purple-900/60 bg-slate-900/90 hover:border-purple-700/80'
      }`}
      style={{ minWidth: '240px' }}
    >
      <Handle
        type="target"
        position={isTB ? Position.Top : Position.Left}
        className="!w-3 !h-3 !rounded-full !bg-purple-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />

      {/* Search Match Badge */}
      {isSearchMatch && (
        <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[8px] uppercase tracking-wider shadow animate-pulse pointer-events-none">
          Busca
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 flex-shrink-0">
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

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Quick Select All Group (Component + Actions + APIs) */}
          {groupElements.length > 1 && (
            <button
              onClick={handleSelectAllGroup}
              className={`p-0.5 rounded transition-colors ${
                allGroupSelected
                  ? 'text-purple-300 bg-purple-500/20'
                  : isPartiallySelected
                  ? 'text-amber-300 bg-amber-500/20'
                  : 'text-slate-500 hover:text-purple-400'
              }`}
              title={
                allGroupSelected
                  ? 'Desmarcar componente e todas ações/APIs do Prompt'
                  : isPartiallySelected
                  ? `Marcar restante do componente (${groupElements.length} elementos) no Prompt`
                  : `Marcar tudo do componente (${groupElements.length} elementos) no Prompt`
              }
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}

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
      </div>

      {/* Mini Wireframe Indicators */}
      {(hasButtons || hasInputs || hasCards || nodeData.actionsCount > 0) && (
        <div className="mt-2 flex items-center gap-1.5 py-1 px-2 rounded-md bg-slate-950/50 border border-slate-800/60 text-[10px] text-slate-400 flex-wrap">
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
          {hasCards && (
            <span className="flex items-center gap-1 text-purple-300">
              <CreditCard className="h-3 w-3 text-purple-400" /> Card
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

      <Handle
        type="source"
        position={isTB ? Position.Bottom : Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-purple-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />
    </div>
  );
};
