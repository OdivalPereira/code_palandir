import type { FlowUINode, FlowUIEdge } from '@/types/graph';

export interface MermaidExportOptions {
  direction?: 'LR' | 'TD';
  includeStyles?: boolean;
  filterDimmed?: boolean;
}

/**
 * Gerador Determinístico de Diagramas Mermaid para Code Palandir.
 * Desenvolvido no padrão Sociedade do Código (Elrond).
 *
 * Converte a topologia visual do grafo (FlowUINode[] e FlowUIEdge[])
 * em código Mermaid válido ('flowchart TD' ou 'flowchart LR') com
 * formatação semântica, escape seguro de caracteres e classes de estilo.
 */
export function generateMermaidDiagram(
  nodes: FlowUINode[],
  edges: FlowUIEdge[],
  options?: MermaidExportOptions
): string {
  const direction = options?.direction || 'LR';
  const includeStyles = options?.includeStyles ?? true;
  const filterDimmed = options?.filterDimmed ?? false;

  const activeNodes = filterDimmed
    ? nodes.filter((n) => !n.data?.isDimmed)
    : nodes;

  const activeNodeIds = new Set(activeNodes.map((n) => n.id));

  const activeEdges = filterDimmed
    ? edges.filter(
        (e) =>
          !e.data?.isDimmed &&
          activeNodeIds.has(e.source) &&
          activeNodeIds.has(e.target)
      )
    : edges.filter(
        (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
      );

  if (activeNodes.length === 0) {
    return `flowchart ${direction}\n  empty["(Grafo Vazio)"]:::defaultStyle`;
  }

  const lines: string[] = [`flowchart ${direction}`];

  // Helper para sanitizar IDs compatíveis com Mermaid (alfanumérico e underscore)
  const sanitizeId = (id: string): string => {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  // Helper para sanitizar labels em caixas de texto com escape de aspas
  const sanitizeLabel = (label: string): string => {
    return label.replace(/"/g, "'").replace(/[<>{}[\]]/g, '');
  };

  // 1. Definição de nós com formato por tipo
  lines.push('\n  %% Nós');
  for (const node of activeNodes) {
    const sId = sanitizeId(node.id);
    const label = sanitizeLabel(node.data?.label || node.id);
    const type = node.data?.nodeType || 'default';

    switch (type) {
      case 'route':
        lines.push(`  ${sId}["🌐 ${label}"]:::routeStyle`);
        break;
      case 'page':
        lines.push(`  ${sId}[["📄 ${label}"]]:::pageStyle`);
        break;
      case 'component':
        lines.push(`  ${sId}["📦 ${label}"]:::compStyle`);
        break;
      case 'action':
        lines.push(`  ${sId}("{⚡ ${label}}"):::actionStyle`);
        break;
      case 'hook':
        lines.push(`  ${sId}("[🪝 ${label}]"):::hookStyle`);
        break;
      case 'store':
        lines.push(`  ${sId}[("💾 ${label}")]:::storeStyle`);
        break;
      case 'api':
        lines.push(`  ${sId}>"☁️ ${label}"]:::apiStyle`);
        break;
      default:
        lines.push(`  ${sId}["${label}"]:::defaultStyle`);
        break;
    }
  }

  // 2. Definição de arestas e relações
  if (activeEdges.length > 0) {
    lines.push('\n  %% Arestas');
    for (const edge of activeEdges) {
      const sourceId = sanitizeId(edge.source);
      const targetId = sanitizeId(edge.target);
      const relation = edge.data?.relation;
      const label = edge.data?.label ? sanitizeLabel(edge.data.label) : '';

      const edgeText = label ? `|${label}| ` : '';

      switch (relation) {
        case 'triggers':
          lines.push(`  ${sourceId} -.->${edgeText}${targetId}`);
          break;
        case 'uses_hook':
        case 'accesses_store':
          lines.push(`  ${sourceId} -.->${edgeText}${targetId}`);
          break;
        case 'calls_api':
          lines.push(`  ${sourceId} ==>|chama| ${targetId}`);
          break;
        case 'routes_to':
          lines.push(`  ${sourceId} ==>|renderiza| ${targetId}`);
          break;
        case 'renders':
        default:
          lines.push(`  ${sourceId} -->${edgeText}${targetId}`);
          break;
      }
    }
  }

  // 3. Estilização CSS integrada
  if (includeStyles) {
    lines.push('\n  %% Estilos Semânticos');
    lines.push('  classDef routeStyle fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#ffffff;');
    lines.push('  classDef pageStyle fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#ffffff;');
    lines.push('  classDef compStyle fill:#4c1d95,stroke:#8b5cf6,stroke-width:1.5px,color:#ffffff;');
    lines.push('  classDef actionStyle fill:#78350f,stroke:#f59e0b,stroke-width:1.5px,color:#ffffff;');
    lines.push('  classDef hookStyle fill:#312e81,stroke:#6366f1,stroke-width:1.5px,color:#ffffff;');
    lines.push('  classDef storeStyle fill:#164e63,stroke:#06b6d4,stroke-width:2px,color:#ffffff;');
    lines.push('  classDef apiStyle fill:#881337,stroke:#f43f5e,stroke-width:2px,color:#ffffff;');
    lines.push('  classDef defaultStyle fill:#0f172a,stroke:#334155,stroke-width:1px,color:#cbd5e1;');
  }

  return lines.join('\n');
}
