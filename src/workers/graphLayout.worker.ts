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

interface TreeNode {
  id: string;
  type: string;
  children: TreeNode[];
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { requestId, nodes, links, width, height, positions } = event.data;

  // Build parent-child relationships from links
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : (link.source as LayoutNode).id;
    const targetId = typeof link.target === 'string' ? link.target : (link.target as LayoutNode).id;

    if (!childrenMap.has(sourceId)) {
      childrenMap.set(sourceId, []);
    }
    childrenMap.get(sourceId)!.push(targetId);
    parentMap.set(targetId, sourceId);
  });

  // Find root nodes (nodes with no parent)
  const rootIds = nodes.filter(n => !parentMap.has(n.id)).map(n => n.id);

  // Build tree structure recursively
  const buildTree = (nodeId: string): TreeNode => {
    const node = nodeById.get(nodeId);
    const children = childrenMap.get(nodeId) || [];
    return {
      id: nodeId,
      type: node?.type || 'file',
      children: children.map(childId => buildTree(childId))
    };
  };

  // Handle case with no nodes
  if (nodes.length === 0) {
    self.postMessage({ requestId, positions: {} });
    return;
  }

  // Handle multiple roots by creating a virtual root
  let treeData: TreeNode;
  let hasVirtualRoot = false;

  if (rootIds.length === 1) {
    treeData = buildTree(rootIds[0]);
  } else if (rootIds.length > 1) {
    hasVirtualRoot = true;
    treeData = {
      id: '__virtual_root__',
      type: 'directory',
      children: rootIds.map(id => buildTree(id))
    };
  } else {
    // No roots found - fallback to grid layout
    const nextPositions: Record<string, { x: number; y: number }> = {};
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      nextPositions[node.id] = {
        x: 100 + col * 150,
        y: 100 + row * 80
      };
    });
    self.postMessage({ requestId, positions: nextPositions });
    return;
  }

  // Create D3 hierarchy
  const root = d3.hierarchy<TreeNode>(treeData);

  // Count total leaves to determine vertical spacing
  const leafCount = root.leaves().length;
  const maxDepth = root.height;

  // Calculate dimensions with proper spacing
  // Minimum 50px between nodes vertically, 180px horizontally
  const nodeHeight = 50;
  const nodeWidth = 180;

  const treeHeight = Math.max(height - 100, leafCount * nodeHeight);
  const treeWidth = Math.max(width - 200, (maxDepth + 1) * nodeWidth);

  // Use horizontal tree layout (root on left, children spread to right)
  const treeLayout = d3.tree<TreeNode>()
    .size([treeHeight, treeWidth])
    .separation((a, b) => {
      // Directories need more space
      const aIsDir = a.data.type === 'directory' || a.data.type === 'cluster';
      const bIsDir = b.data.type === 'directory' || b.data.type === 'cluster';
      if (aIsDir || bIsDir) {
        return a.parent === b.parent ? 1.5 : 2;
      }
      return a.parent === b.parent ? 1 : 1.5;
    });

  treeLayout(root);

  // Extract positions - swap x/y for horizontal orientation
  const nextPositions: Record<string, { x: number; y: number }> = {};

  root.descendants().forEach(d => {
    if (d.data.id !== '__virtual_root__') {
      // In d3.tree: x = vertical position (breadth), y = horizontal position (depth)
      // We swap them for horizontal tree: x = depth (left-to-right), y = breadth (top-to-bottom)
      let xPos = (d.y ?? 0) + 100; // depth becomes x
      let yPos = (d.x ?? 0) + 50;  // breadth becomes y

      // If virtual root exists, shift everything left since virtual root takes first column
      if (hasVirtualRoot && d.depth > 0) {
        xPos = ((d.depth - 1) * nodeWidth) + 100;
      } else if (!hasVirtualRoot) {
        xPos = (d.depth * nodeWidth) + 100;
      }

      nextPositions[d.data.id] = { x: xPos, y: yPos };
    }
  });

  // Handle isolated nodes (not in tree) - place them on the right side
  const positionedIds = new Set(Object.keys(nextPositions));
  let offsetX = treeWidth + 100;
  let offsetY = 50;

  nodes.forEach(node => {
    if (!positionedIds.has(node.id)) {
      nextPositions[node.id] = positions[node.id] || { x: offsetX, y: offsetY };
      offsetY += nodeHeight;
      if (offsetY > height - 50) {
        offsetY = 50;
        offsetX += nodeWidth;
      }
    }
  });

  const response: LayoutResponse = {
    requestId,
    positions: nextPositions
  };
  self.postMessage(response);
};
