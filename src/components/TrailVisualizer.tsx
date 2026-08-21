import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Zap,
  Globe,
  Tag,
  Plus,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCode,
  ArrowDown,
  ArrowRight,
  Compass,
  Check
} from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import { selectActiveTrail } from '../stores/graphSelectors';
import { TrailNode, TrailStage } from '../types';

interface TrailVisualizerProps {
  className?: string;
}

export const TrailVisualizer: React.FC<TrailVisualizerProps> = ({ className = '' }) => {
  const activeTrail = useGraphStore(selectActiveTrail);
  const addCurrentTrailToBasket = useGraphStore((state) => state.addCurrentTrailToBasket);
  const toggleTrailNodeSelection = useGraphStore((state) => state.toggleTrailNodeSelection);

  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');

  const toggleSnippet = (nodeId: string) => {
    setExpandedSnippets((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleCopySnippet = (node: TrailNode) => {
    if (node.codeSnippet) {
      navigator.clipboard.writeText(node.codeSnippet);
      setCopiedNodeId(node.id);
      setTimeout(() => setCopiedNodeId(null), 2000);
    }
  };

  if (!activeTrail || activeTrail.nodes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-slate-950 p-8 text-center text-slate-400 select-none ${className}`}>
        <div className="max-w-md space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Compass size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-100">Nenhuma Trilha Ativa</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Selecione qualquer página, botão ou componente na <strong>Superfície Visual</strong> (Painel 1) para inspecionar a trilha completa de execução:
            </p>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-indigo-300 flex items-center justify-center gap-2">
            <span>Componente UI</span>
            <span>➔</span>
            <span>Hook / Store</span>
            <span>➔</span>
            <span>API / Rede</span>
            <span>➔</span>
            <span>Tipos</span>
          </div>
        </div>
      </div>
    );
  }

  const stageConfig: Record<TrailStage, { title: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
    ui: {
      title: '1. Superfície UI & Handlers',
      icon: <Layers size={14} />,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/30'
    },
    state: {
      title: '2. Estado & Hooks',
      icon: <Zap size={14} />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30'
    },
    network: {
      title: '3. Rede & APIs',
      icon: <Globe size={14} />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30'
    },
    type: {
      title: '4. Tipos & Contratos',
      icon: <Tag size={14} />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30'
    },
    util: {
      title: 'Utilitários & Helpers',
      icon: <FileCode size={14} />,
      color: 'text-slate-400',
      bg: 'bg-slate-800',
      border: 'border-slate-700'
    }
  };

  // Group nodes by stage
  const stages: TrailStage[] = ['ui', 'state', 'network', 'type'];
  const nodesByStage = stages.map((stage) => ({
    stage,
    config: stageConfig[stage],
    nodes: activeTrail.nodes.filter((n) => n.stage === stage)
  })).filter((group) => group.nodes.length > 0);

  const includedCount = activeTrail.nodes.filter((n) => n.includedInContext !== false).length;

  return (
    <div className={`flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden ${className}`}>
      {/* Top Trail Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-semibold">
                Trilha de Execução (Palantír Lens)
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                {activeTrail.nodes.length} nós • ~{activeTrail.estimatedTokens} tokens
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-100 truncate" title={activeTrail.rootPath}>
              {activeTrail.rootName}
            </h2>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOrientation((prev) => (prev === 'vertical' ? 'horizontal' : 'vertical'))}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            title={`Alternar para fluxo ${orientation === 'vertical' ? 'Horizontal' : 'Vertical'}`}
          >
            {orientation === 'vertical' ? <ArrowRight size={14} /> : <ArrowDown size={14} />}
          </button>

          <button
            onClick={addCurrentTrailToBasket}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
          >
            <Plus size={14} />
            <span>Adicionar Trilha ({includedCount}) à Cesta</span>
          </button>
        </div>
      </div>

      {/* Trail Flow Canvas */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className={`flex ${orientation === 'vertical' ? 'flex-col space-y-4' : 'flex-row space-x-4 overflow-x-auto min-h-full items-start'}`}>
          {nodesByStage.map((group, groupIdx) => (
            <React.Fragment key={group.stage}>
              {/* Stage Column / Section */}
              <div className={`space-y-3 ${orientation === 'vertical' ? 'w-full' : 'w-80 flex-shrink-0'}`}>
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className={`p-1 rounded-md ${group.config.bg} ${group.config.color} border ${group.config.border}`}>
                      {group.config.icon}
                    </span>
                    <span className={group.config.color}>{group.config.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {group.nodes.length} {group.nodes.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {/* Nodes Cards in Stage */}
                <div className="space-y-2.5">
                  {group.nodes.map((node) => {
                    const isExpanded = expandedSnippets.has(node.id);
                    const isIncluded = node.includedInContext !== false;

                    return (
                      <div
                        key={node.id}
                        className={`bg-slate-900 border rounded-xl overflow-hidden transition-all shadow-sm ${
                          isIncluded
                            ? 'border-slate-700/90 hover:border-indigo-500/50'
                            : 'border-slate-800/50 opacity-60 bg-slate-950'
                        }`}
                      >
                        {/* Node Card Header */}
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={() => toggleTrailNodeSelection(node.id)}
                                className="w-3.5 h-3.5 rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                                title="Incluir no Contexto / Prompt"
                              />

                              <span className="font-semibold text-xs text-slate-100 truncate">
                                {node.name}
                              </span>
                            </div>

                            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${group.config.bg} ${group.config.color} border ${group.config.border}`}>
                              {node.type}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {node.path}
                          </p>

                          {node.description && (
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {node.description}
                            </p>
                          )}
                        </div>

                        {/* Code Snippet Preview Accordion */}
                        {node.codeSnippet && (
                          <div className="border-t border-slate-800/80 bg-slate-950/80">
                            <div className="p-2 px-3 flex items-center justify-between text-[11px] text-slate-400">
                              <button
                                onClick={() => toggleSnippet(node.id)}
                                className="flex items-center gap-1 hover:text-slate-200 transition-colors font-mono"
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                <span>{isExpanded ? 'Ocultar código' : 'Ver trecho de código'}</span>
                              </button>

                              <button
                                onClick={() => handleCopySnippet(node)}
                                className="p-1 hover:text-indigo-300 transition-colors"
                                title="Copiar trecho"
                              >
                                {copiedNodeId === node.id ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>

                            {isExpanded && (
                              <pre className="p-3 text-[11px] font-mono text-slate-300 bg-slate-950 border-t border-slate-800 overflow-x-auto max-h-56 leading-relaxed">
                                <code>{node.codeSnippet}</code>
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Arrow Connector Between Stages */}
              {groupIdx < nodesByStage.length - 1 && (
                <div className={`flex items-center justify-center ${orientation === 'vertical' ? 'py-1 text-indigo-400/60' : 'px-2 pt-10 text-indigo-400/60'}`}>
                  {orientation === 'vertical' ? (
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-indigo-500/30" />
                      <ArrowDown size={14} className="text-indigo-400" />
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="h-0.5 w-3 bg-indigo-500/30" />
                      <ArrowRight size={14} className="text-indigo-400" />
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrailVisualizer;
