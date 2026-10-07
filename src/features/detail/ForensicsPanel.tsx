import React, { useMemo, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  FileText,
  Activity,
  Zap,
  Target,
  FileCode,
} from 'lucide-react';
import { useGraphStore } from '@/stores/graphStore';
import { useProjectStore } from '@/stores/projectStore';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { auditGraphForensics, type ForensicFinding } from '@/engine/graphForensics';
import { calculateArchitecturalMetrics } from '@/engine/architecturalMetrics';
import { exportToMermaid, generateArchitectureMarkdownReport } from '@/services/graphExporters';
import { copyToClipboard } from '@/services/clipboard';

export const ForensicsPanel: React.FC = () => {
  const { nodes, edges, selectNode } = useGraphStore();
  const analysis = useProjectStore((state) => state.analysis);
  const meta = useProjectStore((state) => state.meta);

  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // 1. Auditoria Forense Topológica
  const forensicsReport = useMemo(() => {
    return auditGraphForensics(nodes, edges);
  }, [nodes, edges]);

  // 2. Cálculo de Métricas de Acoplamento (Martin)
  const healthReport = useMemo(() => {
    if (!analysis) return null;
    return calculateArchitecturalMetrics(analysis);
  }, [analysis]);

  const handleCopyMermaid = async () => {
    const mermaidCode = exportToMermaid(nodes, edges, {
      direction: 'LR',
      includeStyles: true,
    });
    const success = await copyToClipboard(mermaidCode);
    if (success) {
      setCopiedMermaid(true);
      setTimeout(() => setCopiedMermaid(false), 2000);
    }
  };

  const handleCopyReport = async () => {
    if (!analysis) return;
    const reportText = generateArchitectureMarkdownReport(
      analysis,
      nodes,
      edges,
      meta?.name || 'Projeto'
    );
    const success = await copyToClipboard(reportText);
    if (success) {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };

  const handleFocusFinding = (finding: ForensicFinding) => {
    if (finding.nodeIds && finding.nodeIds.length > 0) {
      const targetId = finding.nodeIds[0];
      const targetNode = nodes.find((n) => n.id === targetId);
      if (targetNode) {
        selectNode(targetNode);
      }
    }
  };

  const getSeverityBadge = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return (
          <Badge variant="rose" className="text-[10px] uppercase font-bold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Erro</span>
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="amber" className="text-[10px] uppercase font-bold flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>Aviso</span>
          </Badge>
        );
      case 'info':
      default:
        return (
          <Badge variant="blue" className="text-[10px] uppercase font-bold flex items-center gap-1">
            <Activity className="h-3 w-3" />
            <span>Info</span>
          </Badge>
        );
    }
  };

  const healthScore = healthReport?.overallHealthScore ?? 100;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 text-slate-100 font-sans">
      {/* Header com Score de Saúde */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            {healthScore >= 80 ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            )}
            Auditoria Forense & Saúde
          </h3>
          <p className="text-[11px] text-slate-400">
            Detecção de ciclos, métricas de acoplamento e invariantes topológicas.
          </p>
        </div>
        <div className="flex flex-col items-end">
          <Badge
            variant={
              healthScore >= 80
                ? 'emerald'
                : healthScore >= 60
                ? 'amber'
                : 'rose'
            }
            className="text-xs font-mono font-bold px-2 py-0.5"
          >
            {healthScore} / 100
          </Badge>
          <span className="text-[9px] text-slate-500 font-mono mt-0.5">Índice Geral</span>
        </div>
      </div>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
            Ciclos no Grafo
          </span>
          <div className="flex items-center justify-between">
            <span
              className={`text-base font-bold font-mono ${
                forensicsReport.metrics.cyclesCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {forensicsReport.metrics.cyclesCount}
            </span>
            <Activity className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
            Nós Órfãos
          </span>
          <div className="flex items-center justify-between">
            <span
              className={`text-base font-bold font-mono ${
                forensicsReport.metrics.isolatedNodesCount > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {forensicsReport.metrics.isolatedNodesCount}
            </span>
            <Target className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
            God Components
          </span>
          <div className="flex items-center justify-between">
            <span
              className={`text-base font-bold font-mono ${
                (healthReport?.godComponentsCount || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {healthReport?.godComponentsCount || 0}
            </span>
            <Zap className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
            Violações de API
          </span>
          <div className="flex items-center justify-between">
            <span
              className={`text-base font-bold font-mono ${
                (healthReport?.layerViolationsCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {healthReport?.layerViolationsCount || 0}
            </span>
            <FileCode className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Ações de Exportação Rápida */}
      <div className="space-y-1.5 pt-1">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
          Exportação de Arquitetura
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyMermaid}
            className="w-full justify-center gap-1.5 text-xs text-slate-200 border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:text-white"
          >
            {copiedMermaid ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-indigo-400" />
                <span>Mermaid</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyReport}
            disabled={!analysis}
            className="w-full justify-center gap-1.5 text-xs text-slate-200 border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:text-white"
          >
            {copiedReport ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                <span>Relatório MD</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Achados Forenses Topológicos */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Achados Forenses ({forensicsReport.findings.length})
          </span>
        </div>

        {forensicsReport.findings.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-400">
            <Check className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
            Nenhuma anomalia topológica detectada. O grafo é estritamente acíclico e consistente.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {forensicsReport.findings.map((f, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 space-y-1.5 text-xs transition-colors hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {getSeverityBadge(f.severity)}
                    <span className="font-mono text-[10px] text-slate-400">{f.code}</span>
                  </div>
                  {f.nodeIds && f.nodeIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleFocusFinding(f)}
                      className="h-6 px-1.5 text-[10px] text-indigo-400 hover:text-indigo-200"
                    >
                      Focar
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">{f.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Componentes de Maior Risco de Acoplamento */}
      {healthReport && healthReport.highestRiskComponents.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Gargalos de Acoplamento ({healthReport.highestRiskComponents.length})
          </span>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {healthReport.highestRiskComponents.slice(0, 8).map((c) => (
              <div
                key={c.componentName}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 font-mono truncate max-w-[170px]">
                    {c.componentName}
                  </span>
                  <Badge
                    variant={
                      c.riskLevel === 'critical'
                        ? 'rose'
                        : c.riskLevel === 'high'
                        ? 'amber'
                        : 'secondary'
                    }
                    className="text-[9px] uppercase font-bold"
                  >
                    {c.riskLevel}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                  <span>Ca: {c.afferentCoupling}</span>
                  <span>Ce: {c.efferentCoupling}</span>
                  <span>Instabilidade: {c.instability}</span>
                </div>
                {c.reasons.length > 0 && (
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {c.reasons[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
