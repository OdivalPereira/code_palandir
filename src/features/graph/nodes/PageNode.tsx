import React, { useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileCode, CheckSquare, Square, Layers, CheckCheck, ChevronDown, ChevronRight, Zap, Cloud, Database, Workflow } from 'lucide-react';
import { useSelectionStore } from '@/stores/selectionStore';
import { useGraphStore } from '@/stores/graphStore';
import type { PageNodeData } from '@/types/graph';
import type { SelectedElement } from '@/types/prompt';

export const PageNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as PageNodeData;
  const { isSelected, toggleElement, toggleGroup, isGroupSelected } = useSelectionStore();
  const checked = isSelected(nodeData.id);

  // Collect all elements belonging to this page (page, actions, apis, stores)
  const groupElements = useMemo<SelectedElement[]>(() => {
    const page = nodeData.page;
    const elements: SelectedElement[] = [
      {
        id: nodeData.id,
        label: nodeData.label,
        nodeType: 'page',
        filePath: nodeData.filePath,
        codeSnippet: nodeData.codeSnippet,
      },
    ];

    if (page?.actions) {
      for (const act of page.actions) {
        elements.push({
          id: `node-action-${act.id}`,
          label: `${act.trigger}: ${act.name}`,
          nodeType: 'action',
          filePath: act.filePath,
          codeSnippet: act.codeSnippet,
        });
      }
    }

    if (page?.apiCalls) {
      for (const api of page.apiCalls) {
        elements.push({
          id: `node-api-${api.id}`,
          label: `${api.method} ${api.endpoint}`,
          nodeType: 'api',
          filePath: api.filePath,
          codeSnippet: `// API ${api.method} ${api.endpoint}\n${api.client || 'fetch'}('${api.endpoint}', { method: '${api.method}' });`,
        });
      }
    }

    if (page?.stores) {
      for (const store of page.stores) {
        elements.push({
          id: `node-store-${store.id}`,
          label: store.storeName,
          nodeType: 'store',
          codeSnippet: `// Store ${store.storeName}\nconst ${store.storeName} = use${store.storeName}();`,
        });
      }
    }

    return elements;
  }, [nodeData]);

  const groupIds = useMemo(() => groupElements.map((e) => e.id), [groupElements]);
  const allGroupSelected = isGroupSelected(groupIds);
  const isPartiallySelected = useSelectionStore((s) => s.isGroupPartiallySelected(groupIds));

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

  const handleSelectAllGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleGroup(groupElements);
  };

  const toggleNodeExpanded = useGraphStore((s) => s.toggleNodeExpanded);
  const isExpanded = Boolean(nodeData.isExpanded);
  const totalChildren = nodeData.totalChildrenCount ?? 0;
  const hasChildren = Boolean(nodeData.hasChildren || totalChildren > 0);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNodeExpanded(nodeData.id);
  };

  const isSearchMatch = Boolean(nodeData.isSearchMatch);
  const isDimmed = Boolean(nodeData.isDimmed);
  const isTB = nodeData.layoutDirection === 'TB';

  const childCount = nodeData.childrenCount ?? 0;
  const actionsCount = nodeData.actionsCount ?? 0;
  const apisCount = nodeData.apisCount ?? 0;
  const storesCount = nodeData.storesCount ?? 0;
  const hooksCount = nodeData.hooksCount ?? 0;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-3 shadow-lg backdrop-blur-md transition-all duration-200 ${
        isDimmed ? 'opacity-30 grayscale-[50%] hover:opacity-100 hover:grayscale-0' : 'opacity-100'
      } ${
        isSearchMatch
          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400 shadow-xl shadow-amber-500/25 scale-[1.02] z-30'
          : selected
          ? 'border-emerald-400 bg-emerald-950/70 ring-2 ring-emerald-500/50 shadow-emerald-500/20'
          : checked
          ? 'border-emerald-500/80 bg-slate-900/95 ring-1 ring-emerald-500/40'
          : 'border-emerald-900/60 bg-slate-900/90 hover:border-emerald-700/80'
      }`}
      style={{ minWidth: '240px' }}
    >
      <Handle
        type="target"
        position={isTB ? Position.Top : Position.Left}
        className="!w-3 !h-3 !rounded-full !bg-emerald-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />

      {/* Search Match Badge */}
      {isSearchMatch && (
        <span className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[8px] uppercase tracking-wider shadow animate-pulse pointer-events-none">
          Busca
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
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

        {/* Action Controls & Expand/Collapse Toggle */}
        <div className="flex items-center gap-1">
          {/* Visual Expand / Collapse Button */}
          {hasChildren && (
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                isExpanded
                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
              }`}
              title={
                isExpanded
                  ? 'Recolher elementos filhos desta tela'
                  : `Expandir ${totalChildren} elementos filhos desta tela`
              }
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-3 w-3 text-emerald-400" />
                  <span className="text-[9px]">Recolher</span>
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3 text-emerald-400" />
                  <span className="text-[9px]">+{totalChildren}</span>
                </>
              )}
            </button>
          )}

          {/* Quick Select All Group (Page + Actions + APIs) */}
          {groupElements.length > 1 && (
            <button
              onClick={handleSelectAllGroup}
              className={`p-0.5 rounded transition-colors ${
                allGroupSelected
                  ? 'text-emerald-300 bg-emerald-500/20'
                  : isPartiallySelected
                  ? 'text-amber-300 bg-amber-500/20'
                  : 'text-slate-500 hover:text-emerald-400'
              }`}
              title={
                allGroupSelected
                  ? 'Desmarcar tela e todas ações/APIs do Prompt'
                  : isPartiallySelected
                  ? `Marcar restante da tela (${groupElements.length} elementos) no Prompt`
                  : `Marcar tudo da tela (${groupElements.length} elementos) no Prompt`
              }
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}

          {/* Quick Select Checkbox for this page */}
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
      </div>

      {/* Category Badges (Clickable expand badges) */}
      {hasChildren && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {childCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                isExpanded
                  ? 'bg-purple-950/60 border border-purple-500/40 text-purple-300'
                  : 'bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25'
              }`}
              title={isExpanded ? 'Componentes exibidos no grafo' : `Clique para expandir ${childCount} componentes`}
            >
              <Layers className="h-2.5 w-2.5" />
              <span>{isExpanded ? '' : '+'}{childCount} comp.</span>
            </button>
          )}
          {actionsCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                isExpanded
                  ? 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                  : 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              }`}
              title={isExpanded ? 'Ações exibidas no grafo' : `Clique para expandir ${actionsCount} ações`}
            >
              <Zap className="h-2.5 w-2.5" />
              <span>{isExpanded ? '' : '+'}{actionsCount} ações</span>
            </button>
          )}
          {apisCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                isExpanded
                  ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
              }`}
              title={isExpanded ? 'APIs exibidas no grafo' : `Clique para expandir ${apisCount} APIs`}
            >
              <Cloud className="h-2.5 w-2.5" />
              <span>{isExpanded ? '' : '+'}{apisCount} APIs</span>
            </button>
          )}
          {storesCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                isExpanded
                  ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-300'
                  : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25'
              }`}
              title={isExpanded ? 'Stores exibidas no grafo' : `Clique para expandir ${storesCount} stores`}
            >
              <Database className="h-2.5 w-2.5" />
              <span>{isExpanded ? '' : '+'}{storesCount} stores</span>
            </button>
          )}
          {hooksCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                isExpanded
                  ? 'bg-teal-950/60 border border-teal-500/40 text-teal-300'
                  : 'bg-teal-500/15 border border-teal-500/30 text-teal-300 hover:bg-teal-500/25'
              }`}
              title={isExpanded ? 'Hooks exibidos no grafo' : `Clique para expandir ${hooksCount} hooks`}
            >
              <Workflow className="h-2.5 w-2.5" />
              <span>{isExpanded ? '' : '+'}{hooksCount} hooks</span>
            </button>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1 font-mono truncate max-w-[150px]" title={nodeData.filePath}>
          {nodeData.filePath?.split('/').pop()}
        </span>
        <span className="text-[9px] font-mono text-slate-500">
          {isExpanded ? 'expandido' : 'recolhido'}
        </span>
      </div>

      <Handle
        type="source"
        position={isTB ? Position.Bottom : Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-emerald-400 !border-2 !border-slate-900 shadow hover:!scale-125 !transition-transform"
      />
    </div>
  );
};
