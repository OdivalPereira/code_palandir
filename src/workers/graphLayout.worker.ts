import * as d3 from 'd3';

export interface LayoutNode {
  id: string;
  type: string;
  x?: number;
  y?: number;
}

export interface LayoutLink {
  source: string;
  target: string;
}

export interface LayoutRequest {
  requestId: number;
  nodes: LayoutNode[];
  links: LayoutLink[];
  width: number;
  height: number;
  positions?: Record<string, { x: number; y: number }>;
}

export interface LayoutResponse {
  requestId: number;
  positions: Record<string, { x: number; y: number }>;
}

/**
 * Validates and clamps a coordinate to ensure it is finite and safe.
 */
function sanitizeCoord(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/**
 * Computes a resilient DAG layout that handles:
 * 1. Circular dependencies (breaks cycles with DFS coloring)
 * 2. Multi-parent / diamond dependencies (assigns max depth)
 * 3. Isolated / orphan nodes
 * 4. Multi-root forests & cyclic graphs without zero-indegree roots
 */
export function computeGraphLayout(
  nodes: LayoutNode[],
  links: LayoutLink[],
  width: number,
  height: number,
  existingPositions: Record<string, { x: number; y: number }> = {}
): Record<string, { x: number; y: number }> {
  if (!nodes || nodes.length === 0) {
    return {};
  }

  const nodeMap = new Map<string, LayoutNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const validLinks: { source: string; target: string }[] = [];
  const linkSet = new Set<string>();

  links.forEach(link => {
    const sId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
    const tId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;

    if (sId && tId && sId !== tId && nodeMap.has(sId) && nodeMap.has(tId)) {
      const linkKey = `${sId}-->${tId}`;
      if (!linkSet.has(linkKey)) {
        linkSet.add(linkKey);
        validLinks.push({ source: sId, target: tId });
      }
    }
  });

  // Build adjacency graph
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(n => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  validLinks.forEach(link => {
    adj.get(link.source)!.push(link.target);
    inDegree.set(link.target, (inDegree.get(link.target) || 0) + 1);
  });

  // 1. Cycle Breaking using DFS 3-state coloring
  // 0 = unvisited, 1 = visiting (in recursion stack), 2 = visited
  const state = new Map<string, number>();
  nodes.forEach(n => state.set(n.id, 0));

  const dagAdj = new Map<string, string[]>();
  const dagInDegree = new Map<string, number>();
  nodes.forEach(n => {
    dagAdj.set(n.id, []);
    dagInDegree.set(n.id, 0);
  });

  function removeCyclesDFS(u: string) {
    state.set(u, 1);
    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (state.get(v) === 1) {
        // Back-edge detected (cycle) -> skip adding to DAG
        continue;
      }
      dagAdj.get(u)!.push(v);
      dagInDegree.set(v, (dagInDegree.get(v) || 0) + 1);
      if (state.get(v) === 0) {
        removeCyclesDFS(v);
      }
    }
    state.set(u, 2);
  }

  // Visit all nodes to break cycles across all components
  nodes.forEach(n => {
    if (state.get(n.id) === 0) {
      removeCyclesDFS(n.id);
    }
  });

  // 2. Determine Roots (in-degree 0 in DAG)
  let roots = nodes.filter(n => (dagInDegree.get(n.id) || 0) === 0).map(n => n.id);
  if (roots.length === 0 && nodes.length > 0) {
    // If still no roots (all nodes had back-edges or isolated loops), pick node with max out-degree
    const sortedByOut = [...nodes].sort(
      (a, b) => (adj.get(b.id)?.length || 0) - (adj.get(a.id)?.length || 0)
    );
    roots = [sortedByOut[0].id];
  }

  // 3. Assign Topological Ranks (Levels)
  const rank = new Map<string, number>();
  const queue: { id: string; level: number }[] = roots.map(id => ({ id, level: 0 }));
  roots.forEach(id => rank.set(id, 0));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    const neighbors = dagAdj.get(id) || [];
    for (const v of neighbors) {
      const currentRank = rank.get(v);
      const nextRank = level + 1;
      if (currentRank === undefined || nextRank > currentRank) {
        rank.set(v, nextRank);
        queue.push({ id: v, level: nextRank });
      }
    }
  }

  // Assign rank for any disconnected or unreached nodes
  nodes.forEach(n => {
    if (!rank.has(n.id)) {
      rank.set(n.id, 0);
    }
  });

  // 4. Group nodes by rank
  const levels = new Map<number, string[]>();
  nodes.forEach(n => {
    const r = rank.get(n.id) ?? 0;
    if (!levels.has(r)) levels.set(r, []);
    levels.get(r)!.push(n.id);
  });

  // Spacing parameters
  const nodeWidth = 200;
  const nodeHeight = 55;
  const startX = 80;
  const startY = 60;

  const positions: Record<string, { x: number; y: number }> = {};

  // Sort nodes within each level by directory/file type and name for neat layout
  levels.forEach((nodeIds, levelIndex) => {
    nodeIds.sort((aId, bId) => {
      const aNode = nodeMap.get(aId);
      const bNode = nodeMap.get(bId);
      const aIsDir = aNode?.type === 'directory' || aNode?.type === 'cluster';
      const bIsDir = bNode?.type === 'directory' || bNode?.type === 'cluster';
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return (aNode?.id || '').localeCompare(bNode?.id || '');
    });

    const xPos = startX + levelIndex * nodeWidth;
    nodeIds.forEach((id, indexInLevel) => {
      const yPos = startY + indexInLevel * nodeHeight;
      positions[id] = {
        x: sanitizeCoord(xPos, 100),
        y: sanitizeCoord(yPos, 100)
      };
    });
  });

  // Refine layout: If force layout requested or to untangle edges, run bounded D3 force
  try {
    const simNodes = nodes.map(n => {
      const pos = positions[n.id] || existingPositions[n.id] || { x: width / 2, y: height / 2 };
      return {
        id: n.id,
        type: n.type,
        x: sanitizeCoord(pos.x, width / 2),
        y: sanitizeCoord(pos.y, height / 2),
        targetX: sanitizeCoord(positions[n.id]?.x, width / 2),
        targetY: sanitizeCoord(positions[n.id]?.y, height / 2)
      };
    });

    const simLinks = validLinks.map(l => ({
      source: l.source,
      target: l.target
    }));

    const simulation = d3.forceSimulation(simNodes as any)
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(120).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('x', d3.forceX((d: any) => d.targetX).strength(0.8))
      .force('y', d3.forceY((d: any) => d.targetY).strength(0.6))
      .force('collide', d3.forceCollide((d: any) => {
        const isDir = d.type === 'directory' || d.type === 'cluster' || d.type === 'app';
        return isDir ? 30 : 20;
      }))
      .stop();

    // Run a fixed number of iterations for stability (zero unbounded execution)
    const MAX_TICKS = 80;
    for (let i = 0; i < MAX_TICKS; i++) {
      simulation.tick();
      if (simulation.alpha() < 0.01) break;
    }

    simNodes.forEach(node => {
      positions[node.id] = {
        x: sanitizeCoord(node.x, positions[node.id]?.x ?? width / 2),
        y: sanitizeCoord(node.y, positions[node.id]?.y ?? height / 2)
      };
    });
  } catch (err) {
    // If D3 force fails for any reason, keep the robust DAG positions
    console.warn('[graphLayout.worker] Force relaxation skipped, using DAG positions:', err);
  }

  // Final verification of all nodes
  const cols = Math.ceil(Math.sqrt(nodes.length));
  nodes.forEach((node, index) => {
    if (!positions[node.id] || !Number.isFinite(positions[node.id].x) || !Number.isFinite(positions[node.id].y)) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions[node.id] = {
        x: 100 + col * 180,
        y: 80 + row * 60
      };
    }
  });

  return positions;
}

// Worker message handler
self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { requestId, nodes, links, width, height, positions: existingPositions } = event.data;

  try {
    const finalPositions = computeGraphLayout(nodes, links, width, height, existingPositions);
    const response: LayoutResponse = {
      requestId,
      positions: finalPositions
    };
    self.postMessage(response);
  } catch (error) {
    console.error('[graphLayout.worker] Layout calculation error:', error);
    // Emergency fallback grid
    const emergencyPositions: Record<string, { x: number; y: number }> = {};
    if (Array.isArray(nodes)) {
      const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
      nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        emergencyPositions[node.id] = {
          x: 100 + col * 180,
          y: 80 + row * 60
        };
      });
    }
    self.postMessage({ requestId, positions: emergencyPositions });
  }
};
