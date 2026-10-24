import type { FlowUINode, FlowUIEdge } from '@/types/graph';
import type { ProjectAnalysis, ArchitecturalHealthReport } from '@/types/analysis';
import { generateMermaidDiagram, type MermaidExportOptions } from './mermaidGenerator';
import { calculateArchitecturalMetrics } from '@/engine/architecturalMetrics';

/** Value inside a Markdown table cell as inline code: a "|" or a backtick must not break the table. */
function codigoCelula(valor: string | undefined | null): string {
  const texto = String(valor ?? '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
  return texto.includes('`') ? `\`\` ${texto} \`\`` : `\`${texto}\``;
}

export function exportToMermaid(
  nodes: FlowUINode[],
  edges: FlowUIEdge[],
  options?: MermaidExportOptions
): string {
  return generateMermaidDiagram(nodes, edges, options);
}

/**
 * Gera um Relatório Executivo e Técnico Completo de Raio-X Arquitetural em Markdown.
 * Desenvolvido no padrão Sociedade do Código (Radagast & Elrond).
 *
 * Pronto para inclusão em documentação técnica, RFCs, README e PR descriptions.
 */
export function generateArchitectureMarkdownReport(
  analysis: ProjectAnalysis,
  nodes: FlowUINode[],
  edges: FlowUIEdge[],
  projectName: string = 'Projeto'
): string {
  const metrics: ArchitecturalHealthReport =
    analysis.architecturalHealth || calculateArchitecturalMetrics(analysis);

  const mermaidDiagram = generateMermaidDiagram(nodes, edges, {
    direction: 'LR',
    includeStyles: true,
  });

  const lines: string[] = [
    `# Raio-X Arquitetural — ${projectName}`,
    `\n> **Gerado por:** Code Palandir (Ferramenta Oficial da Sociedade do Código)`,
    `> **Data:** ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
    `> **Framework Identificado:** \`${analysis.framework}\``,
    `> **Tempo de Análise:** ${analysis.analysisDurationMs}ms`,
    `\n---`,
    `\n## 1. Sumário Executivo & Saúde Arquitetural\n`,
    `| Métrica | Valor | Avaliação |`,
    `|---|---|---|`,
    `| **Score de Saúde Arquitetural** | **${metrics.overallHealthScore} / 100** | ${getHealthLabel(metrics.overallHealthScore)} |`,
    `| **Total de Telas (Pages)** | ${analysis.pages.length} | ${analysis.pages.length > 0 ? 'Mapeadas' : 'Sem telas dedicadas'} |`,
    `| **Total de Componentes UI** | ${analysis.components.length} | Entidades detectadas |`,
    `| **Rotas de Frontend** | ${analysis.routes.length} | Pontos de entrada de usuário |`,
    `| **Instabilidade Média (Martin)** | ${metrics.averageInstability} | ${metrics.averageInstability > 0.7 ? 'Predomínio de nós folhas' : 'Equilibrado'} |`,
    `| **God Components Detectados** | ${metrics.godComponentsCount} | ${metrics.godComponentsCount === 0 ? 'Nenhum (Ótimo)' : 'Requer Refatoração'} |`,
    `| **Violações de Camada (API direta na UI)** | ${metrics.layerViolationsCount} | ${metrics.layerViolationsCount === 0 ? 'Isolamento perfeito' : 'Requer isolamento em stores/hooks'} |`,
  ];

  // 2. Tabela de Componentes de Alto Risco / God Components
  if (metrics.highestRiskComponents.length > 0) {
    lines.push('\n## 2. Componentes Críticos e Gargalos de Acoplamento\n');
    lines.push('| Componente | Tipo | Ca (Aferente) | Ce (Eferente) | Instabilidade ($I$) | Risco | Diagnóstico |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const comp of metrics.highestRiskComponents.slice(0, 10)) {
      const typeLabel = comp.isPage ? 'Página' : 'Componente';
      const riskBadge =
        comp.riskLevel === 'critical'
          ? '🔴 Crítico'
          : comp.riskLevel === 'high'
          ? '🟠 Alto'
          : '🟡 Médio';
      lines.push(
        `| ${codigoCelula(comp.componentName)} | ${typeLabel} | ${comp.afferentCoupling} | ${comp.efferentCoupling} | ${comp.instability} | ${riskBadge} | ${comp.reasons.join('; ').replace(/\|/g, '\\|')} |`
      );
    }
  }

  // 3. Catálogo de Rotas
  if (analysis.routes.length > 0) {
    lines.push('\n## 3. Catálogo de Rotas e Telas Mapeadas\n');
    lines.push('| Rota | Componente de Página | Arquivo |');
    lines.push('|---|---|---|');
    for (const route of analysis.routes) {
      lines.push(
        `| ${codigoCelula(route.path)} | ${codigoCelula(`<${route.pageComponentName} />`)} | ${codigoCelula(route.filePath)} |`
      );
    }
  }

  // 4. Inventário de APIs e Stores
  lines.push('\n## 4. Integrações Externas (APIs e Estados Globais)\n');
  lines.push(`- **Chamadas de API Catalogadas:** ${analysis.apiCalls.length}`);
  if (analysis.apiCalls.length > 0) {
    lines.push('\n| Método | Endpoint | Componente Chamador | Cliente |');
    lines.push('|---|---|---|---|');
    for (const api of analysis.apiCalls.slice(0, 15)) {
      lines.push(
        `| ${codigoCelula(api.method)} | ${codigoCelula(api.endpoint)} | ${codigoCelula(api.callerComponent)} | ${codigoCelula(api.client || 'fetch')} |`
      );
    }
  }

  lines.push(`\n- **Acessos a Stores Globais:** ${analysis.stores.length}`);
  if (analysis.stores.length > 0) {
    const uniqueStores = Array.from(new Set(analysis.stores.map((s) => s.storeName)));
    lines.push(`Stores ativas: ${uniqueStores.map((s) => `\`${s}\``).join(', ')}`);
  }

  // 5. Diagrama Mermaid do Grafo Ativo
  lines.push('\n## 5. Diagrama Topológico de Arquitetura (Mermaid)\n');
  lines.push('```mermaid');
  lines.push(mermaidDiagram);
  lines.push('```');

  lines.push('\n---\n*Relatório emitido pela Sociedade do Código sob conformidade com as Regras O(1) de integridade do Code Palandir.*');

  return lines.join('\n');
}

function getHealthLabel(score: number): string {
  if (score >= 90) return '🟢 Excelente';
  if (score >= 75) return '🟢 Saudável';
  if (score >= 60) return '🟡 Moderado';
  if (score >= 40) return '🟠 Atenção';
  return '🔴 Crítico';
}
