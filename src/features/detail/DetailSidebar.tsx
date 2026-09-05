import React from 'react';
import {
  FileCode,
  Globe,
  Layers,
  Zap,
  Box,
  Database,
  Cloud,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { ComponentWireframe } from './ComponentWireframe';
import type { UINodeType } from '@/types/graph';

export const DetailSidebar: React.FC = () => {
  const selectedNode = useGraphStore((state) => state.selectedNode);
  const { selectedElements, toggleElement, isSelected } = useSelectionStore();
  const setSidebarTab = useUIStore((state) => state.setSidebarTab);

  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500">
        <Layers className="h-10 w-10 text-slate-700 mb-3" />
        <h4 className="text-sm font-medium text-slate-400">Nenhum elemento selecionado</h4>
        <p className="mt-1 text-xs text-slate-500 max-w-[200px]">
          Clique em qualquer nó no grafo para inspecionar seus detalhes e código.
        </p>
      </div>
    );
  }

  const { data } = selectedNode;
  const nodeType = data.nodeType as UINodeType;
  const isElementSelected = isSelected(data.id);

  const handleToggleSelection = () => {
    toggleElement({
      id: data.id,
      label: data.label,
      nodeType,
      filePath: data.filePath,
      codeSnippet: data.codeSnippet,
    });
  };

  const getBadgeVariant = (type: UINodeType) => {
    switch (type) {
      case 'route': return 'blue';
      case 'page': return 'emerald';
      case 'component': return 'purple';
      case 'action': return 'amber';
      case 'hook': return 'default';
      case 'store': return 'cyan';
      case 'api': return 'rose';
      default: return 'secondary';
    }
  };

  const getNodeIcon = (type: UINodeType) => {
    switch (type) {
      case 'route': return <Globe className="h-4 w-4 text-blue-400" />;
      case 'page': return <FileCode className="h-4 w-4 text-emerald-400" />;
      case 'component': return <Box className="h-4 w-4 text-purple-400" />;
      case 'action': return <Zap className="h-4 w-4 text-amber-400" />;
      case 'hook': return <Code2 className="h-4 w-4 text-indigo-400" />;
      case 'store': return <Database className="h-4 w-4 text-cyan-400" />;
      case 'api': return <Cloud className="h-4 w-4 text-rose-400" />;
    }
  };

  // Extract component info if component or page
  const component = 'component' in data ? (data.component as any) : 'page' in data ? (data.page as any) : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={getBadgeVariant(nodeType)} className="uppercase text-[10px]">
              {getNodeIcon(nodeType)}
              <span className="ml-1 font-bold">{nodeType}</span>
            </Badge>
          </div>
          <h3 className="text-base font-semibold text-slate-100 truncate" title={data.label}>
            {data.label}
          </h3>
          {data.filePath && (
            <p className="text-[11px] text-slate-400 font-mono truncate" title={data.filePath}>
              {data.filePath}
            </p>
          )}
        </div>
      </div>

      {/* Action Button: Add/Remove from Prompt Basket */}
      <div className="pt-1">
        <Button
          onClick={handleToggleSelection}
          variant={isElementSelected ? 'outline' : 'default'}
          className="w-full justify-center gap-2 h-10 shadow-md"
        >
          {isElementSelected ? (
            <>
              <Check className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-300 font-medium">Incluído no Prompt</span>
              <Trash2 className="h-3.5 w-3.5 ml-auto text-slate-500 hover:text-rose-400" />
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>Adicionar ao Prompt</span>
            </>
          )}
        </Button>
      </div>

      {/* Wireframe Preview (if component or page) */}
      {component && component.wireframe && (
        <div>
          <ComponentWireframe elements={component.wireframe} componentName={component.name} />
        </div>
      )}

      {/* Actions (if available) */}
      {component && component.actions && component.actions.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Ações e Eventos ({component.actions.length})
          </span>
          <div className="space-y-1.5">
            {component.actions.map((act: any) => (
              <div
                key={act.id}
                className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 p-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <div>
                    <span className="text-slate-200 font-mono">{act.name}</span>
                    <span className="text-[10px] text-slate-500 block">{act.trigger}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-indigo-400 hover:text-indigo-300"
                  onClick={() => {
                    toggleElement({
                      id: act.id,
                      label: `${act.trigger}: ${act.name}`,
                      nodeType: 'action',
                      filePath: act.filePath,
                      codeSnippet: act.codeSnippet,
                    });
                  }}
                >
                  {isSelected(act.id) ? 'Remover' : '+ Prompt'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Child Components */}
      {component && component.childrenNames && component.childrenNames.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Componentes Filhos Renderizados ({component.childrenNames.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {component.childrenNames.map((name: string) => (
              <span
                key={name}
                className="inline-flex items-center rounded-md bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 text-xs text-purple-300 font-mono"
              >
                &lt;{name} /&gt;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Code Snippet */}
      {data.codeSnippet && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Trecho de Código
          </span>
          <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-60 border border-slate-800/80">
            <pre className="whitespace-pre">{data.codeSnippet}</pre>
          </div>
        </div>
      )}

      {/* Prompt Basket Quick Jump */}
      {selectedElements.length > 0 && (
        <div className="mt-auto pt-4 border-t border-slate-800">
          <Button
            onClick={() => setSidebarTab('prompt')}
            className="w-full justify-between bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30"
          >
            <span>Ver Prompt ({selectedElements.length} selecionados)</span>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
