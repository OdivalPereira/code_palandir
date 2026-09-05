import React from 'react';
import type { UIWireframeElement } from '@/types/analysis';
import { Layout, Type, FormInput, Table, Heading, MousePointerClick } from 'lucide-react';

interface ComponentWireframeProps {
  elements: UIWireframeElement[];
  componentName: string;
}

export const ComponentWireframe: React.FC<ComponentWireframeProps> = ({ elements, componentName }) => {
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
          Preview Estrutural (Wireframe)
        </span>
        <span className="text-[10px] text-slate-500 font-mono">{componentName}</span>
      </div>

      <div className="space-y-2 py-1">
        {elements.map((el) => {
          switch (el.type) {
            case 'button':
              return (
                <div
                  key={el.id}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-indigo-600/20 border border-indigo-500/40 px-3 py-1.5 text-xs text-indigo-200 font-medium shadow-sm"
                >
                  <MousePointerClick className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{el.label || 'Botão de Ação'}</span>
                  {el.actionName && (
                    <span className="text-[10px] text-indigo-300/70 font-mono">({el.actionName})</span>
                  )}
                </div>
              );

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
                  <span>{el.label || 'Título de Seção'}</span>
                </div>
              );

            case 'form':
              return (
                <div
                  key={el.id}
                  className="rounded-lg border border-dashed border-indigo-500/30 bg-indigo-950/10 p-2.5 text-xs text-indigo-300"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 block mb-1.5">
                    Formulário
                  </span>
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
