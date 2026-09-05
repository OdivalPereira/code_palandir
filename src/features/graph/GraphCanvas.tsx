import React, { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

import { FolderOpen, Sparkles, Layers, ArrowRight } from 'lucide-react';
import { Button } from '@/ui/Button';

const GraphCanvasInner: React.FC = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, selectNode, filters } = useGraphStore();
  const { setSidebarTab, setImportModalOpen } = useUIStore();
  const meta = useProjectStore((state) => state.meta);
  const isAnalyzing = useProjectStore((state) => state.isAnalyzing);
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

  // If analyzing
  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-950 text-slate-300">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <h3 className="text-base font-semibold text-slate-100">Analisando Arquitetura do Frontend...</h3>
        <p className="text-xs text-slate-500 mt-1">
          Descobrindo rotas, telas, componentes JSX e manipuladores de eventos...
        </p>
      </div>
    );
  }

  // If no project loaded yet
  if (!meta || nodes.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full w-full bg-slate-950 px-6 text-center">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/20">
            <Layers className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Code Palandir <span className="text-indigo-400">v2</span>
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Visualize seu projeto frontend a partir da visão do usuário: rotas, telas, cards, botões e ações integradas. Selecione múltiplos elementos para gerar prompts cirúrgicos para IA.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => setImportModalOpen(true)}
              className="w-full sm:w-auto gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Conectar Projeto</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Como Funciona:
            </h4>
            <ul className="text-xs text-slate-400 space-y-1.5">
              <li>• <strong>1. Conecte:</strong> Abra uma pasta local, envie um arquivo ZIP ou informe um repo do GitHub.</li>
              <li>• <strong>2. Explore:</strong> Veja a rede de telas e componentes organizados por fluxo de usuário.</li>
              <li>• <strong>3. Selecione:</strong> Marque botões, cards ou formulários que quer alterar.</li>
              <li>• <strong>4. Gere o Prompt:</strong> Copie o prompt estruturado com código e contexto para a sua IA.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

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
