import type { FlowUINode, FlowUIEdge } from '@/types/graph';

export interface ForensicFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface GraphForensicsReport {
  isValid: boolean;
  timestamp: string;
  nodeCount: number;
  edgeCount: number;
  density: number;
  findings: ForensicFinding[];
  metrics: {
    rootsCount: number;
    leavesCount: number;
    isolatedNodesCount: number;
    cyclesCount: number;
  };
}

/**
 * Motor de Auditoria Forense para Integridade Lógica de Grafos UI no Code Palandir.
 * Audita consistência referencial, arestas fantasmas, auto-laços, arestas paralelas duplicadas,
 * ciclos direcionados na árvore de rotas/renderização, componentes órfãos/isolados
 * e invariantes algébricas topológicas.
 */
export function auditGraphForensics(nodes: FlowUINode[], edges: FlowUIEdge[]): GraphForensicsReport {
  const findings: ForensicFinding[] = [];
  const nodeMap = new Map<string, FlowUINode>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  }

  // 1. Auditoria de arestas: IDs únicos, nós fantasmas, laços reflexivos, paralelas duplicadas
  const seenEdgeIds = new Set<string>();
  const seenEdgePairs = new Map<string, string>(); // 'source:::target' -> first edgeId

  for (const edge of edges) {
    // 1.1 Checagem de ID duplicado de aresta
    if (seenEdgeIds.has(edge.id)) {
      findings.push({
        severity: 'error',
        code: 'DUPLICATE_EDGE',
        message: `ID de aresta duplicado detectado: "${edge.id}"`,
        edgeIds: [edge.id],
      });
    } else {
      seenEdgeIds.add(edge.id);
    }

    const hasSource = nodeMap.has(edge.source);
    const hasTarget = nodeMap.has(edge.target);

    // 1.2 Checagem de arestas fantasmas (PHANTOM_EDGE)
    if (!hasSource || !hasTarget) {
      const missingDetails: string[] = [];
      const missingIds: string[] = [];
      if (!hasSource) {
        missingDetails.push(`origem "${edge.source}"`);
        missingIds.push(edge.source);
      }
      if (!hasTarget) {
        missingDetails.push(`destino "${edge.target}"`);
        missingIds.push(edge.target);
      }
      findings.push({
        severity: 'error',
        code: 'PHANTOM_EDGE',
        message: `Aresta "${edge.id}" referencia nó(s) inexistente(s): ${missingDetails.join(', ')}`,
        edgeIds: [edge.id],
        nodeIds: missingIds,
      });
      continue; // Arestas fantasmas não participam de graus topológicos válidos
    }

    // 1.3 Checagem de auto-laço / aresta reflexiva inválida (SELF_LOOP)
    if (edge.source === edge.target) {
      findings.push({
        severity: 'error',
        code: 'SELF_LOOP',
        message: `Aresta reflexiva / auto-laço inválido detectado no nó "${edge.source}" (aresta: "${edge.id}")`,
        edgeIds: [edge.id],
        nodeIds: [edge.source],
      });
    }

    // 1.4 Checagem de arestas paralelas duplicadas (DUPLICATE_EDGE)
    const pairKey = `${edge.source}:::${edge.target}`;
    if (seenEdgePairs.has(pairKey)) {
      const prevEdgeId = seenEdgePairs.get(pairKey)!;
      findings.push({
        severity: 'warning',
        code: 'DUPLICATE_EDGE',
        message: `Aresta paralela duplicada encontrada entre nó "${edge.source}" e nó "${edge.target}" (arestas: "${prevEdgeId}", "${edge.id}")`,
        edgeIds: [prevEdgeId, edge.id],
        nodeIds: [edge.source, edge.target],
      });
    } else {
      seenEdgePairs.set(pairKey, edge.id);
    }

    // Contabiliza graus de nós válidos existentes
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // 2. Auditoria de nós: Componentes isolados/órfãos e métricas de raízes/folhas
  let isolatedNodesCount = 0;
  let rootsCount = 0;
  let leavesCount = 0;

  for (const node of nodes) {
    const inDeg = inDegree.get(node.id) || 0;
    const outDeg = outDegree.get(node.id) || 0;

    if (inDeg === 0 && outDeg === 0) {
      isolatedNodesCount++;
      findings.push({
        severity: 'warning',
        code: 'ISOLATED_NODE',
        message: `Nó isolado/órfão detectado sem conexões de entrada ou saída: "${node.id}" (${node.data?.label || node.data?.nodeType || 'sem label'})`,
        nodeIds: [node.id],
      });
    } else {
      if (inDeg === 0) {
        rootsCount++;
      }
      if (outDeg === 0) {
        leavesCount++;
      }
    }
  }

  // 3. Detecção de Ciclos Direcionados (DIRECTED_CYCLE) via DFS com 3 cores e extração do ciclo
  const adj = new Map<string, Array<{ target: string; edgeId: string }>>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target) && edge.source !== edge.target) {
      adj.get(edge.source)?.push({ target: edge.target, edgeId: edge.id });
    }
  }

  const visited = new Set<string>(); // Nós finalizados (BLACK)
  const inStack = new Map<string, number>(); // Nó -> índice no currentPath (GRAY)
  const currentPath: Array<{ nodeId: string; incomingEdgeId?: string }> = [];
  const reportedCycleKeys = new Set<string>();
  let cyclesCount = 0;

  function dfs(u: string) {
    inStack.set(u, currentPath.length - 1);

    const neighbors = adj.get(u) || [];
    for (const { target: v, edgeId } of neighbors) {
      if (inStack.has(v)) {
        // Back-edge encontrada: ciclo detectado!
        const startIndex = inStack.get(v)!;
        const cycleSlice = currentPath.slice(startIndex);
        const cycleNodes = cycleSlice.map((item) => item.nodeId);
        const cycleEdges = cycleSlice
          .slice(1)
          .map((item) => item.incomingEdgeId!)
          .concat(edgeId);

        // Chave canônica para evitar duplicação do mesmo ciclo visitado por nós distintos
        const minIdx = cycleNodes.reduce(
          (bestIdx, curr, idx, arr) => (curr < arr[bestIdx] ? idx : bestIdx),
          0
        );
        const canonicalNodes = [
          ...cycleNodes.slice(minIdx),
          ...cycleNodes.slice(0, minIdx),
        ];
        const canonicalKey = canonicalNodes.join('->');

        if (!reportedCycleKeys.has(canonicalKey)) {
          reportedCycleKeys.add(canonicalKey);
          cyclesCount++;
          findings.push({
            severity: 'error',
            code: 'DIRECTED_CYCLE',
            message: `Ciclo direcionado detectado: ${[...cycleNodes, v].join(' -> ')}`,
            nodeIds: cycleNodes,
            edgeIds: cycleEdges,
          });
        }
      } else if (!visited.has(v)) {
        currentPath.push({ nodeId: v, incomingEdgeId: edgeId });
        dfs(v);
        currentPath.pop();
      }
    }

    inStack.delete(u);
    visited.add(u);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      currentPath.push({ nodeId: node.id });
      dfs(node.id);
      currentPath.pop();
    }
  }

  // 4. Invariantes Algébricas: Densidade |E| / (|V| * (|V| - 1)) para |V| > 1
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const density = nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0;

  // 5. Validação global: válido se e somente se não há violações com severidade 'error'
  const isValid = !findings.some((f) => f.severity === 'error');

  return {
    isValid,
    timestamp: new Date().toISOString(),
    nodeCount,
    edgeCount,
    density,
    findings,
    metrics: {
      rootsCount,
      leavesCount,
      isolatedNodesCount,
      cyclesCount,
    },
  };
}
