import React from 'react';
import { BarChart3, Loader2, Network, Route, Sparkles } from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import {
  selectAiMetrics,
  selectAiMetricsError,
  selectAiMetricsStatus,
  selectAllFilePaths,
  selectFlowPathNodeIds,
  selectFlowQuery,
  selectGraphLinks,
  selectGraphNodes,
  selectIsPromptOpen,
  selectProjectSummary,
  selectRootNode,
  selectSemanticLinksById,
  selectSidebarTab,
  selectSummaryError,
  selectSummaryPromptBase,
  selectSummaryStatus,
  selectNodesById,
  selectLinksById
} from '../stores/graphSelectors';
import PromptBuilder from './PromptBuilder';
import ModuleRecommendations from './ModuleRecommendations';
import ThreadLibrary from './ThreadLibrary';
import { Link } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(value);

const formatPercent = (value: number) =>
  `${(value * 100).toFixed(1)}%`;

const buildFlowPath = (sourceId: string, targetId: string, links: Link[], nodeIds: Set<string>) => {
  if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return null;
  const adjacency = new Map<string, { id: string; linkId: string }[]>();
  const registerEdge = (from: string, to: string, linkId: string) => {
    const neighbors = adjacency.get(from) ?? [];
    neighbors.push({ id: to, linkId });
    adjacency.set(from, neighbors);
  };
  const getLinkId = (link: Link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    return link.kind ? `${link.kind}:${sourceId}-->${targetId}` : `${sourceId}-->${targetId}`;
  };
  links.forEach((link) => {
    const source = typeof link.source === 'string' ? link.source : link.source.id;
    const target = typeof link.target === 'string' ? link.target : link.target.id;
    const linkId = getLinkId(link);
    registerEdge(source, target, linkId);
    registerEdge(target, source, linkId);
  });
  const queue: string[] = [sourceId];
  const visited = new Set<string>([sourceId]);
  const prevNode = new Map<string, string | null>();
  const prevLink = new Map<string, string | null>();
  prevNode.set(sourceId, null);
  prevLink.set(sourceId, null);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) break;
    const neighbors = adjacency.get(current) ?? [];
    neighbors.forEach((neighbor) => {
      if (visited.has(neighbor.id)) return;
      visited.add(neighbor.id);
      prevNode.set(neighbor.id, current);
      prevLink.set(neighbor.id, neighbor.linkId);
      queue.push(neighbor.id);
    });
  }

  if (!visited.has(targetId)) return null;
  const nodePath: string[] = [];
  const linkPath: string[] = [];
  let current: string | null = targetId;
  while (current) {
    nodePath.push(current);
    const linkId = prevLink.get(current);
    if (linkId) {
      linkPath.push(linkId);
    }
    current = prevNode.get(current) ?? null;
  }
  return { nodeIds: nodePath.reverse(), linkIds: linkPath.reverse() };
};

const PromptSidebarPanel: React.FC = () => {
  const isPromptOpen = useGraphStore(selectIsPromptOpen);
  const sidebarTab = useGraphStore(selectSidebarTab);
  const rootNode = useGraphStore(selectRootNode);
  const flowQuery = useGraphStore(selectFlowQuery);
  const flowPathNodeIds = useGraphStore(selectFlowPathNodeIds);
  const graphNodes = useGraphStore(selectGraphNodes);
  const graphLinks = useGraphStore(selectGraphLinks);
  const nodesById = useGraphStore(selectNodesById);
  const linksById = useGraphStore(selectLinksById);
  const semanticLinksById = useGraphStore(selectSemanticLinksById);
  const summaryPromptBase = useGraphStore(selectSummaryPromptBase);
  const summaryStatus = useGraphStore(selectSummaryStatus);
  const summaryError = useGraphStore(selectSummaryError);
  const projectSummary = useGraphStore(selectProjectSummary);
  const aiMetrics = useGraphStore(selectAiMetrics);
  const aiMetricsStatus = useGraphStore(selectAiMetricsStatus);
  const aiMetricsError = useGraphStore(selectAiMetricsError);
  const allFilePaths = useGraphStore(selectAllFilePaths);
  const graphViewMode = useGraphStore((state) => state.graphViewMode);
  const setSummaryPromptBase = useGraphStore((state) => state.setSummaryPromptBase);
  const generateSummary = useGraphStore((state) => state.generateSummary);
  const setFlowQuery = useGraphStore((state) => state.setFlowQuery);
  const setFlowHighlight = useGraphStore((state) => state.setFlowHighlight);
  const clearFlowHighlight = useGraphStore((state) => state.clearFlowHighlight);
  const refreshAiMetrics = useGraphStore((state) => state.refreshAiMetrics);
  const setPromptOpen = useGraphStore((state) => state.setPromptOpen);

  const flowNodeOptions = React.useMemo(() => {
    const options = graphNodes.map((node) => ({
      id: node.id,
      label: node.path ? `${node.name} (${node.path})` : node.name
    }));
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [graphNodes]);

  const flowPathNodeIdList = React.useMemo(() => Array.from(flowPathNodeIds), [flowPathNodeIds]);
  const flowSourceId = flowQuery.sourceId ?? '';
  const flowTargetId = flowQuery.targetId ?? '';

  const flowBreadcrumbs = React.useMemo(() => {
    if (flowPathNodeIdList.length === 0) return [];
    return flowPathNodeIdList.map((id) => {
      const node = nodesById[id];
      return {
        id,
        label: node?.name ?? id,
        detail: node?.path ?? id
      };
    });
  }, [flowPathNodeIdList, nodesById]);

  React.useEffect(() => {
    if (!flowQuery.sourceId || !flowQuery.targetId) {
      clearFlowHighlight();
      return;
    }
    if (flowQuery.sourceId === flowQuery.targetId) {
      clearFlowHighlight();
      return;
    }
    const nodeIds = new Set(graphNodes.map((node) => node.id));
    const path = buildFlowPath(flowQuery.sourceId, flowQuery.targetId, graphLinks, nodeIds);
    if (!path) {
      clearFlowHighlight();
      return;
    }
    setFlowHighlight(path.nodeIds, path.linkIds);
  }, [flowQuery, graphLinks, graphNodes, clearFlowHighlight, setFlowHighlight]);

  return (
    <div
      className={`bg-slate-900 border-l border-slate-800 transition-all duration-300 ease-in-out flex flex-col ${isPromptOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full opacity-0'
        }`}
    >
      <div className="flex-1 overflow-hidden">
        {sidebarTab === 'prompt' ? (
          <PromptBuilder />
        ) : sidebarTab === 'summary' ? (
          <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                <Network size={18} className="text-indigo-400" />
                Project Summary
              </h2>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">
                {Object.keys(nodesById).length} nodes
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Prompt base</label>
                <textarea
                  value={summaryPromptBase}
                  onChange={(event) => setSummaryPromptBase(event.target.value)}
                  className="w-full h-40 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>Arquivos carregados: <span className="text-slate-200">{allFilePaths.length}</span></p>
                <p>Conexões do grafo (estrutural): <span className="text-slate-200">{Object.keys(linksById).length}</span></p>
                <p>Conexões do grafo (semântico): <span className="text-slate-200">{Object.keys(semanticLinksById).length}</span></p>
              </div>
              {Object.keys(semanticLinksById).length === 0 && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                  <strong>Dica:</strong> Clique em arquivos no grafo para analisar suas dependências e gerar conexões semânticas.
                </div>
              )}
              <button
                onClick={generateSummary}
                disabled={!rootNode || summaryStatus === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white py-2.5 rounded-lg font-medium transition-colors"
              >
                {summaryStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Gerar resumo
              </button>
              {summaryError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                  {summaryError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Resumo</h3>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">
                    {projectSummary?.summary || 'Nenhum resumo gerado ainda.'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Diagrama lógico (Mermaid)</h3>
                  <pre className="bg-slate-950 p-2 rounded text-xs text-slate-300 overflow-x-auto border border-slate-800 whitespace-pre-wrap">
                    {projectSummary?.diagram || 'flowchart TD\n  A[Contexto] --> B[Resumo]\n  B --> C[Mermaid]'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : sidebarTab === 'flow' ? (
          <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                <Route size={18} className="text-amber-400" />
                Consulta de fluxo
              </h2>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">
                {graphViewMode === 'semantic' ? 'Semântico' : 'Estrutural'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Entrypoint</label>
                <select
                  value={flowSourceId}
                  onChange={(event) => setFlowQuery(event.target.value || null, flowQuery.targetId)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione o ponto de entrada</option>
                  {flowNodeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Destino</label>
                <select
                  value={flowTargetId}
                  onChange={(event) => setFlowQuery(flowQuery.sourceId, event.target.value || null)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione o destino</option>
                  {flowNodeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFlowQuery(null, null);
                    clearFlowHighlight();
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-2 rounded"
                >
                  Limpar
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Breadcrumbs</label>
                {flowBreadcrumbs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {flowBreadcrumbs.map((crumb) => (
                      <div key={crumb.id} className="bg-slate-950 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-200">
                        <span className="font-semibold">{crumb.label}</span>
                        <span className="text-slate-400 ml-1">{crumb.detail}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {flowSourceId && flowTargetId
                      ? flowSourceId === flowTargetId
                        ? 'Entrypoint e destino precisam ser diferentes.'
                        : 'Nenhum caminho encontrado para a visão atual.'
                      : 'Defina entrypoint e destino para visualizar o caminho.'}
                  </p>
                )}
              </div>
              <div className="text-xs text-slate-300 bg-slate-950 border border-slate-700 rounded p-3">
                {flowBreadcrumbs.length > 0
                  ? `Caminho encontrado com ${flowBreadcrumbs.length} nós e ${flowBreadcrumbs.length - 1} passos.`
                  : 'A explicação do fluxo aparecerá aqui após definir a consulta.'}
              </div>
            </div>
          </div>
        ) : sidebarTab === 'metrics' ? (
          <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-400" />
                Métricas de IA
              </h2>
              <button
                onClick={refreshAiMetrics}
                className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full"
              >
                Atualizar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {aiMetricsStatus === 'loading' && (
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Carregando métricas...
                </div>
              )}
              {aiMetricsError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                  {aiMetricsError}
                </div>
              )}
              {aiMetrics && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                      <p className="text-xs text-slate-400">Custo total</p>
                      <p className="text-sm text-slate-100 font-semibold">
                        {formatCurrency(aiMetrics.summary.totalCostUsd)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Média {formatCurrency(aiMetrics.summary.averageCostUsd)}
                      </p>
                    </div>
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                      <p className="text-xs text-slate-400">Latência média</p>
                      <p className="text-sm text-slate-100 font-semibold">
                        {aiMetrics.summary.averageLatencyMs.toFixed(0)} ms
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {aiMetrics.summary.totalRequests} chamadas
                      </p>
                    </div>
                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3">
                      <p className="text-xs text-slate-400">Hit rate</p>
                      <p className="text-sm text-slate-100 font-semibold">
                        {formatPercent(aiMetrics.summary.hitRate)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {aiMetrics.summary.successCount} sucessos
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-wide text-slate-400">Últimas chamadas</h3>
                      <span className="text-[10px] text-slate-500">
                        Atualizado {new Date(aiMetrics.summary.lastUpdated).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {aiMetrics.recent.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhuma chamada registrada.</p>
                      ) : (
                        aiMetrics.recent.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between text-xs text-slate-300 border border-slate-800 rounded px-2 py-2">
                            <div>
                              <p className="font-semibold text-slate-200">{entry.requestType}</p>
                              <p className="text-[10px] text-slate-500">
                                {new Date(entry.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[11px] ${entry.success ? 'text-emerald-300' : 'text-red-300'}`}>
                                {entry.success ? 'OK' : 'Erro'}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {entry.latencyMs?.toFixed ? entry.latencyMs.toFixed(0) : entry.latencyMs} ms
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : sidebarTab === 'library' ? (
          <ThreadLibrary onClose={() => setPromptOpen(false)} />
        ) : (
          <ModuleRecommendations />
        )}
      </div>
    </div>
  );
};

export default PromptSidebarPanel;
