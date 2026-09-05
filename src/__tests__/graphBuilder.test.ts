import { describe, it, expect } from 'vitest';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { analyzeProject } from '@/engine/analyzers';
import { createDemoProjectFiles } from '@/services/demoProject';

describe('buildGraphFromAnalysis', () => {
  it('converts analysis into React Flow nodes and edges with coordinates', () => {
    const demoFiles = createDemoProjectFiles();
    const analysis = analyzeProject(demoFiles);

    const { nodes, edges } = buildGraphFromAnalysis(analysis);

    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);

    // Verify all nodes have calculated positions (x, y)
    for (const node of nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(node.data.label).toBeDefined();
    }

    // Verify node types exist
    const nodeTypes = new Set(nodes.map((n) => n.data.nodeType));
    expect(nodeTypes.has('route')).toBe(true);
    expect(nodeTypes.has('page')).toBe(true);
    expect(nodeTypes.has('component')).toBe(true);
  });
});
