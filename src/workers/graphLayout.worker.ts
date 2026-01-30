import * as d3 from 'd3';

interface LayoutNode {
  id: string;
  type: string;
  x?: number;
  y?: number;
}

interface LayoutLink {
  source: string;
  target: string;
}

interface LayoutRequest {
  requestId: number;
  nodes: LayoutNode[];
  links: LayoutLink[];
  width: number;
  height: number;
  positions: Record<string, { x: number; y: number }>;
}

interface LayoutResponse {
  requestId: number;
  positions: Record<string, { x: number; y: number }>;
}

const isAggregateNode = (node?: LayoutNode | null) => node?.type === 'directory' || node?.type === 'cluster';

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { requestId, nodes, links, width, height, positions } = event.data;
  const nodeById = new Map(nodes.map(node => [node.id, node]));

  const simulationNodes: LayoutNode[] = nodes.map((node, index) => {
    const existing = positions[node.id];
    const jitter = (index % 10) * 4;
    return {
      ...node,
      x: existing?.x ?? width / 2 + jitter,
      y: existing?.y ?? height / 2 + jitter
    };
  });

  const simulationLinks: LayoutLink[] = links.map(link => ({ ...link }));

  const simulation = d3.forceSimulation(simulationNodes)
    .force(
      "link",
      d3.forceLink(simulationLinks)
        .id(d => (d as LayoutNode).id)
        .distance(link => {
          const target = (link.target as LayoutNode | string);
          const targetNode = typeof target === 'string' ? nodeById.get(target) : target;
          return isAggregateNode(targetNode) ? 150 : 80;
        })
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(40))
    .stop();

  const tickCount = 240;
  for (let i = 0; i < tickCount; i += 1) {
    simulation.tick();
  }

  const nextPositions: Record<string, { x: number; y: number }> = {};
  simulationNodes.forEach(node => {
    nextPositions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 };
  });

  const response: LayoutResponse = {
    requestId,
    positions: nextPositions
  };
  self.postMessage(response);
};
