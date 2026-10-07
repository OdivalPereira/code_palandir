import React, { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';

import { RouteNode } from './nodes/RouteNode';
import { PageNode } from './nodes/PageNode';
import { ComponentNode } from './nodes/ComponentNode';
import { ActionNode } from './nodes/ActionNode';
import { HookNode } from './nodes/HookNode';
import { StoreNode } from './nodes/StoreNode';
import { ApiNode } from './nodes/ApiNode';
import { CustomEdge } from './edges/CustomEdge';

import {
  FolderOpen,
  Sparkles,
  Layers,
  ArrowRight,
  FoldHorizontal,
  UnfoldHorizontal,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/ui/Button';
import { cn } from '@/lib/utils';

const GraphCanvasInner: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    selectNode,
    filters,
    collapseAll,
    expandAll,
    setExpansionLevel,
    expansionLevel,
    expandedNodeIds,
  } = useGraphStore();
  const { setSidebarTab, setImportModalOpen } = useUIStore();
  const meta = useProjectStore((state) => state.meta);
  const isAnalyzing = useProjectStore((state) => state.isAnalyzing);
  const error = useProjectStore((state) => state.error);
  const runAnalysis = useProjectStore((state) => state.runAnalysis);
  const reset = useProjectStore((state) => state.reset);
  const analysis = useProjectStore((state) => state.analysis);
  const { fitView } = useReactFlow();

  const nodeTypes = useMemo(
    () => ({
      route: RouteNode,
      page: PageNode,
      component: ComponentNode,
      action: ActionNode,
      hook: HookNode,
      store: StoreNode,
      api: ApiNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      customEdge: CustomEdge,
    }),
    []
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectNode(node as any);
      setSidebarTab('detail');
    },
    [selectNode, setSidebarTab]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const lastFocusedQueryRef = React.useRef<string>('');

  // Smoothly focus on search results when query changes
  useEffect(() => {
    const query = filters.searchQuery.trim();
    if (!query) {
      lastFocusedQueryRef.current = '';
      return;
    }
    if (lastFocusedQueryRef.current === query) {
      return; // Do not jerk/refocus viewport while user is dragging nodes
    }
    const matchingNodes = nodes.filter((n) => n.data.isSearchMatch);
    if (matchingNodes.length > 0) {
      lastFocusedQueryRef.current = query;
      fitView({
        nodes: matchingNodes,
        duration: 500,
        padding: 0.35,
      });
    }
  }, [filters.searchQuery, nodes, fitView]);

  // Partial data warning detector (e.g. warnings, ignored files, or unknown framework)
  const partialWarning = useMemo(() => {
    const metaAny = meta as any;
    const analysisAny = analysis as any;

    if (Array.isArray(metaAny?.warnings) && metaAny.warnings.length > 0) {
      return metaAny.warnings[0];
    }
    if (Array.isArray(analysisAny?.warnings) && analysisAny.warnings.length > 0) {
      return analysisAny.warnings[0];
    }
    const ignoredCount = metaAny?.ignoredCount ?? metaAny?.ignoredFiles?.length;
    if (typeof ignoredCount === 'number' && ignoredCount > 0) {
      return `${ignoredCount} arquivo(s) foram ignorados durante a análise.`;
    }
    if (metaAny?.isPartial) {
      return 'Dados parciais: o projeto contém elementos não mapeados integralmente.';
    }
    if (meta?.framework === 'unknown') {
      return 'Aviso: Framework não identificado com precisão. Análise parcial exibida.';
    }
    return null;
  }, [meta, analysis]);

  // Search without results detection
  const isSearchEmpty = Boolean(
    filters?.searchQuery?.trim() &&
    nodes.length > 0 &&
    !nodes.some((n) => n.data?.isSearchMatch)
  );

  // 1. Loading state: accessible spinner and status
  if (isAnalyzing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center h-full w-full bg-slate-950 text-slate-300"
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4"
          aria-hidden="true"
        />
        <h3 className="text-base font-semibold text-slate-100">
          Analisando Arquitetura do Frontend...
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Descobrindo rotas, telas, componentes JSX e manipuladores de eventos...
        </p>
        <span className="sr-only">Carregando análise do projeto...</span>
      </div>
    );
  }

  // 2. Error state: accessible alert, error description, and recovery actions
  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="relative flex flex-col items-center justify-center h-full w-full bg-slate-950 px-6 text-center"
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-xl shadow-rose-950/40 mb-4"
          aria-hidden="true"
        >
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100">
          Erro na Análise do Projeto
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-300 leading-relaxed">
          {error}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="default"
            onClick={() => runAnalysis()}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            aria-label="Tentar novamente a análise do projeto"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Tentar Novamente</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => reset()}
            className="gap-2 text-slate-200 hover:text-white"
            aria-label="Reiniciar e voltar ao início"
          >
            Reiniciar
          </Button>
        </div>
      </div>
    );
  }

  // 3. Empty state: accessible welcome hero and connect action
  if (!meta || nodes.length === 0) {
    return (
      <div
        role="region"
        aria-label="Tela de boas-vindas do Code Palandir"
        className="relative flex flex-col items-center justify-center h-full w-full bg-slate-950 px-6 text-center"
      >
        {/* Subtle Background Pattern */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-lg space-y-6">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/20"
            aria-hidden="true"
          >
            <Layers className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Code Palandir <span className="text-indigo-400">v2</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Visualize seu projeto frontend a partir da visão do usuário: rotas, telas, cards, botões e ações integradas. Selecione múltiplos elementos para gerar prompts cirúrgicos para IA.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => setImportModalOpen(true)}
              className="w-full sm:w-auto gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25"
              aria-label="Conectar Projeto"
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              <span>Conectar Projeto</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              Como Funciona:
            </h4>
            <ul className="text-xs text-slate-300 space-y-1.5">
              <li>• <strong className="text-slate-100">1. Conecte:</strong> Abra uma pasta local, envie um arquivo ZIP ou informe um repo do GitHub.</li>
              <li>• <strong className="text-slate-100">2. Explore:</strong> Veja a rede de telas e componentes organizados por fluxo de usuário.</li>
              <li>• <strong className="text-slate-100">3. Selecione:</strong> Marque botões, cards ou formulários que quer alterar.</li>
              <li>• <strong className="text-slate-100">4. Gere o Prompt:</strong> Copie o prompt estruturado com código e contexto para a sua IA.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 4, 5, 6: Success state with fluid ReactFlow graph, partial banner, and empty search indication
  return (
    <div className="h-full w-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes as any}
        edgeTypes={edgeTypes as any}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'customEdge' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />

        {/* Floating Canvas Expansion & Depth Toolbar */}
        <Panel position="top-left" className="!m-3">
          <div
            role="toolbar"
            aria-label="Controles de visualização e profundidade do grafo"
            className="flex items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-950/85 p-1.5 shadow-2xl backdrop-blur-md text-xs"
          >
            {/* Depth Level Selector */}
            <div
              role="group"
              aria-label="Nível de profundidade do grafo"
              className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800/80"
            >
              <button
                type="button"
                onClick={() => setExpansionLevel(1)}
                aria-label="Nível 1: Telas e Rotas (Recolher Tudo)"
                aria-pressed={expansionLevel === 1}
                title="Nível 1: Telas e Rotas (Recolher Tudo)"
                className={cn(
                  'px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  expansionLevel === 1
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                )}
              >
                <FoldHorizontal className="h-3 w-3" aria-hidden="true" />
                <span>Telas</span>
              </button>
              <button
                type="button"
                onClick={() => setExpansionLevel(2)}
                aria-label="Nível 2: Mostrar Telas e Componentes diretos"
                aria-pressed={expansionLevel === 2}
                title="Nível 2: Mostrar Telas e Componentes diretos"
                className={cn(
                  'px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  expansionLevel === 2
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                )}
              >
                <Layers className="h-3 w-3" aria-hidden="true" />
                <span>Componentes</span>
              </button>
              <button
                type="button"
                onClick={() => setExpansionLevel(3)}
                aria-label="Nível 3: Expandir Tudo (Componentes, Ações, APIs, Stores)"
                aria-pressed={expansionLevel === 3}
                title="Nível 3: Expandir Tudo (Componentes, Ações, APIs, Stores)"
                className={cn(
                  'px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  expansionLevel === 3
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                )}
              >
                <UnfoldHorizontal className="h-3 w-3" aria-hidden="true" />
                <span>Tudo</span>
              </button>
            </div>

            {/* Quick Toggle All */}
            <button
              type="button"
              onClick={expandedNodeIds.size > 0 ? collapseAll : expandAll}
              aria-label={expandedNodeIds.size > 0 ? 'Recolher todos os nós' : 'Expandir todos os nós'}
              title={expandedNodeIds.size > 0 ? 'Recolher todos os nós' : 'Expandir todos os nós'}
              className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/90 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {expandedNodeIds.size > 0 ? (
                <>
                  <FoldHorizontal className="h-3 w-3 text-indigo-400" aria-hidden="true" />
                  <span>Recolher</span>
                </>
              ) : (
                <>
                  <UnfoldHorizontal className="h-3 w-3 text-indigo-400" aria-hidden="true" />
                  <span>Expandir</span>
                </>
              )}
            </button>

            {/* Visible Node Count Badge */}
            <span
              role="status"
              aria-label={`${nodes.length} nós visíveis`}
              className="text-[10px] font-mono text-slate-300 px-1.5 py-0.5 rounded bg-slate-900/50 border border-slate-800/40"
            >
              {nodes.length} nós
            </span>
          </div>
        </Panel>

        {/* Subtle Partial Data Warning Banner */}
        {partialWarning && (
          <Panel position="top-right" className="!m-3">
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-slate-950/90 px-3 py-1.5 text-xs text-amber-200 shadow-xl backdrop-blur-md"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span>{partialWarning}</span>
            </div>
          </Panel>
        )}

        {/* Empty Search Feedback */}
        {isSearchEmpty && (
          <Panel position="top-center" className="!m-3">
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-300 shadow-xl backdrop-blur-md"
            >
              <span>Nenhum elemento encontrado para &ldquo;{filters.searchQuery}&rdquo;</span>
            </div>
          </Panel>
        )}

        <Controls className="!bg-slate-900 !border-slate-800 !text-slate-200 !shadow-lg" />
        <MiniMap
          nodeColor={(n: any) => {
            switch (n.data?.nodeType) {
              case 'route': return '#3b82f6';
              case 'page': return '#10b981';
              case 'component': return '#a855f7';
              case 'action': return '#f59e0b';
              case 'store': return '#06b6d4';
              case 'api': return '#f43f5e';
              default: return '#6366f1';
            }
          }}
          className="!bg-slate-900/90 !border-slate-800 !rounded-xl overflow-hidden shadow-xl"
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  );
};

export const GraphCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
};
