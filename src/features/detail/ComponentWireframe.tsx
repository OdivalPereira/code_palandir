import React from 'react';
import type { UIWireframeElement, ComponentAction } from '@/types/analysis';
import { useSelectionStore } from '@/stores/selectionStore';
import {
  Layout,
  Type,
  FormInput,
  Table,
  Heading,
  MousePointerClick,
  Tag,
  CreditCard,
  PanelTop,
  List,
  Image as ImageIcon,
  SlidersHorizontal,
  Check,
} from 'lucide-react';

interface ComponentWireframeProps {
  elements: UIWireframeElement[];
  componentName: string;
  filePath?: string;
  actions?: ComponentAction[];
}

export const ComponentWireframe: React.FC<ComponentWireframeProps> = ({
  elements,
  componentName,
  filePath,
  actions,
}) => {
  const { isSelected, toggleElement } = useSelectionStore();

  if (!elements || elements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center">
        <Layout className="mx-auto h-6 w-6 text-slate-600 mb-1" />
        <p className="text-xs text-slate-500">Wireframe não disponível</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 shadow-inner">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layout className="h-3.5 w-3.5 text-indigo-400" />
          Preview Estrutural (Wireframe Interativo)
        </span>
        <span className="text-[10px] text-slate-500 font-mono">{componentName}</span>
      </div>

      <div className="space-y-2 py-1">
        {elements.map((el) => {
          switch (el.type) {
            case 'button': {
              const matchingAction = actions?.find(
                (a) =>
                  a.name === el.actionName ||
                  (el.actionName && a.name.toLowerCase().includes(el.actionName.toLowerCase()))
              );
              const elementId = matchingAction ? `node-action-${matchingAction.id}` : `wf-btn-${componentName}-${el.id}`;
              const isActionSelected = isSelected(elementId);

              const handleClick = () => {
                if (matchingAction) {
                  toggleElement({
                    id: elementId,
                    label: `${matchingAction.trigger}: ${matchingAction.name}`,
                    nodeType: 'action',
                    filePath: matchingAction.filePath || filePath,
                    codeSnippet: matchingAction.codeSnippet,
                  });
                } else {
                  toggleElement({
                    id: elementId,
                    label: `Botão: ${el.label || 'Botão de Interface'}`,
                    nodeType: 'action',
                    filePath,
                    codeSnippet: `<button>${el.label || 'Botão'}</button>`,
                  });
                }
              };

              return (
                <div
                  key={el.id}
                  onClick={handleClick}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all select-none cursor-pointer ${
                    isActionSelected
                      ? 'bg-emerald-600/30 border border-emerald-500/60 text-emerald-200 shadow-md ring-1 ring-emerald-500/30'
                      : 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 hover:border-indigo-400 hover:bg-indigo-600/30 shadow-sm'
                  }`}
                  title={
                    isActionSelected
                      ? `Botão no Prompt (clique para remover)`
                      : matchingAction
                      ? `Clique para incluir ação "${matchingAction.name}" no Prompt`
                      : `Clique para incluir botão "${el.label || 'Botão'}" no Prompt`
                  }
                >
                  {isActionSelected ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <MousePointerClick className="h-3.5 w-3.5 text-indigo-400" />
                  )}
                  <span className="truncate">{el.label || 'Botão de Ação'}</span>
                  {el.actionName && (
                    <span className="text-[10px] text-indigo-300/70 font-mono">({el.actionName})</span>
                  )}
                </div>
              );
            }

            case 'input':
              return (
                <div
                  key={el.id}
                  className="flex items-center gap-2 rounded-md bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-400 font-mono shadow-inner"
                >
                  <FormInput className="h-3.5 w-3.5 text-slate-500" />
                  <span className="truncate">{el.placeholder || 'Campo de entrada...'}</span>
                </div>
              );

            case 'heading':
              return (
                <div key={el.id} className="flex items-center gap-1.5 py-1 text-slate-200 font-semibold text-xs border-b border-slate-800/40">
                  <Heading className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{el.label || 'Título de Seção'}</span>
                </div>
              );

            case 'card':
              return (
                <div
                  key={el.id}
                  className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 space-y-2 shadow-sm"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 text-xs text-slate-200 font-semibold">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{el.label || 'Card de Conteúdo'}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-3/4 rounded bg-slate-800/80" />
                    <div className="h-2 w-1/2 rounded bg-slate-800/50" />
                  </div>
                </div>
              );

            case 'badge':
              return (
                <div
                  key={el.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-0.5 text-[11px] font-medium text-indigo-300 shadow-sm"
                >
                  <Tag className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                  <span className="truncate">{el.label || 'Badge'}</span>
                </div>
              );

            case 'modal':
              return (
                <div
                  key={el.id}
                  className="rounded-lg border border-indigo-500/40 bg-slate-900/90 p-2.5 space-y-2 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-xs font-semibold text-slate-200">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <PanelTop className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate">{el.label || 'Modal / Diálogo'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">ESC</span>
                  </div>
                  <div className="space-y-1 py-1">
                    <div className="h-2 w-full rounded bg-slate-800/70" />
                    <div className="h-2 w-4/5 rounded bg-slate-800/50" />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-800/60">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[9px] text-slate-400">Cancelar</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-600/70 text-[9px] text-indigo-100 font-medium">OK</span>
                  </div>
                </div>
              );

            case 'list':
              return (
                <div
                  key={el.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 space-y-1.5 text-xs text-slate-300"
                >
                  <div className="flex items-center gap-1.5 font-medium text-[11px] text-slate-400 border-b border-slate-800/60 pb-1">
                    <List className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{el.label || 'Lista de Itens'}</span>
                  </div>
                  <div className="space-y-1 pl-1 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      <span>Item 1</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      <span>Item 2</span>
                    </div>
                  </div>
                </div>
              );

            case 'tabs':
              return (
                <div
                  key={el.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-2"
                >
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{el.label || 'Abas de Navegação'}</span>
                  </div>
                  <div className="flex gap-1 border-b border-slate-800 pb-1 text-[10px]">
                    <span className="px-2 py-0.5 rounded-t bg-indigo-600/30 text-indigo-200 font-medium border-b-2 border-indigo-400">
                      Aba 1
                    </span>
                    <span className="px-2 py-0.5 text-slate-500 hover:text-slate-300">
                      Aba 2
                    </span>
                    <span className="px-2 py-0.5 text-slate-500 hover:text-slate-300">
                      Aba 3
                    </span>
                  </div>
                </div>
              );

            case 'image':
              return (
                <div
                  key={el.id}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 py-2.5 text-xs text-slate-400"
                >
                  <ImageIcon className="h-4 w-4 text-slate-500" />
                  <span className="text-[11px] font-mono truncate">{el.label || 'Imagem'}</span>
                </div>
              );

            case 'form':
              return (
                <div
                  key={el.id}
                  className="rounded-lg border border-dashed border-indigo-500/40 bg-indigo-950/20 p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                    <span>{el.label || 'Formulário'}</span>
                    <span className="text-[9px] text-indigo-300/70 font-mono">&lt;form /&gt;</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-6 w-full rounded bg-slate-900/80 border border-slate-800 px-2 text-[10px] text-slate-500 flex items-center">
                      Campo de entrada...
                    </div>
                  </div>
                </div>
              );

            case 'table':
              return (
                <div
                  key={el.id}
                  className="rounded-md border border-slate-800 bg-slate-900/40 p-2 text-xs text-slate-400"
                >
                  <div className="flex items-center gap-1.5 text-slate-300 mb-1">
                    <Table className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-[11px]">Tabela de Dados</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 border-t border-slate-800/60 pt-1">
                    <div className="bg-slate-800/40 p-1 rounded">Col 1</div>
                    <div className="bg-slate-800/40 p-1 rounded">Col 2</div>
                    <div className="bg-slate-800/40 p-1 rounded">Col 3</div>
                  </div>
                </div>
              );

            default:
              return (
                <div key={el.id} className="flex items-center gap-1 text-xs text-slate-400">
                  <Type className="h-3 w-3 text-slate-500" />
                  <span>{el.label || 'Elemento de Texto'}</span>
                </div>
              );
          }
        })}
      </div>
    </div>
  );
};
