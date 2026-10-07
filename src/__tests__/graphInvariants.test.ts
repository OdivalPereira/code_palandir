import { describe, it, expect } from 'vitest';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { analyzeProject } from '@/engine/analyzers';
import { createDemoProjectFiles } from '@/services/demoProject';
import type { ProjectAnalysis } from '@/types/analysis';
import type { FlowUINode, FlowUIEdge, GraphFilterState, FlowUIEdgeRelation } from '@/types/graph';

// Expected dimensions per node type as defined in the layout engine
const EXPECTED_NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  route: { width: 210, height: 64 },
  page: { width: 260, height: 96 },
  component: { width: 270, height: 125 },
  action: { width: 200, height: 52 },
  hook: { width: 170, height: 46 },
  store: { width: 190, height: 52 },
  api: { width: 220, height: 56 },
};

/**
 * Analytical Oracle: Graph Closure
 * Asserts that the graph is mathematically closed:
 * 1. Every edge source must exist in the node set.
 * 2. Every edge target must exist in the node set.
 * 3. Every edge has a unique identifier.
 * 4. Every node has a unique identifier.
 */
function assertGraphClosure(nodes: FlowUINode[], edges: FlowUIEdge[]) {
  const nodeIds = new Set(nodes.map((n) => n.id));
  expect(nodeIds.size).toBe(nodes.length);

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    expect(edgeIds.has(edge.id)).toBe(false);
    edgeIds.add(edge.id);

    expect(nodeIds.has(edge.source)).toBe(true);
    expect(nodeIds.has(edge.target)).toBe(true);
  }
}

/**
 * Analytical Oracle: Dagre Layout Invariants
 * Asserts that all nodes have valid, finite, non-negative coordinates
 * and that node dimensions are strictly positive.
 */
function assertDagreInvariants(nodes: FlowUINode[]) {
  for (const node of nodes) {
    expect(typeof node.position.x).toBe('number');
    expect(typeof node.position.y).toBe('number');
    expect(Number.isFinite(node.position.x)).toBe(true);
    expect(Number.isFinite(node.position.y)).toBe(true);
    expect(node.position.x).toBeGreaterThanOrEqual(0);
    expect(node.position.y).toBeGreaterThanOrEqual(0);

    const dims = EXPECTED_NODE_DIMENSIONS[node.data.nodeType] || { width: 210, height: 60 };
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  }
}

describe('Graph Invariants: Dagre Layout Validation', () => {
  const demoFiles = createDemoProjectFiles();
  const analysis = analyzeProject(demoFiles);

  it('guarantees valid finite non-negative coordinates and positive dimensions in LR layout', () => {
    // Test collapsed, partially expanded, and fully expanded
    const collapsed = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set());
    expect(collapsed.nodes.length).toBeGreaterThan(0);
    assertDagreInvariants(collapsed.nodes);

    const firstPage = analysis.pages[0];
    const partiallyExpanded = buildGraphFromAnalysis(
      analysis,
      undefined,
      'LR',
      new Set([`node-page-${firstPage.id}`])
    );
    expect(partiallyExpanded.nodes.length).toBeGreaterThan(collapsed.nodes.length);
    assertDagreInvariants(partiallyExpanded.nodes);

    const fullyExpanded = buildGraphFromAnalysis(analysis, undefined, 'LR');
    expect(fullyExpanded.nodes.length).toBeGreaterThan(partiallyExpanded.nodes.length);
    assertDagreInvariants(fullyExpanded.nodes);
  });

  it('guarantees valid finite non-negative coordinates in TB (top-to-bottom) layout', () => {
    const tbGraph = buildGraphFromAnalysis(analysis, undefined, 'TB');
    expect(tbGraph.nodes.length).toBeGreaterThan(0);
    assertDagreInvariants(tbGraph.nodes);

    // Verify all nodes record the correct layoutDirection in their data
    for (const node of tbGraph.nodes) {
      expect(node.data.layoutDirection).toBe('TB');
    }
  });

  it('handles empty analysis cleanly without producing NaN or invalid coordinates', () => {
    const emptyAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 0,
    };

    const result = buildGraphFromAnalysis(emptyAnalysis);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });
});

describe('Graph Invariants: Absence of Phantom Nodes (Graph Closure)', () => {
  const demoFiles = createDemoProjectFiles();
  const analysis = analyzeProject(demoFiles);

  it('satisfies strict graph closure across fully expanded graph', () => {
    const { nodes, edges } = buildGraphFromAnalysis(analysis);
    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);
    assertGraphClosure(nodes, edges);

    // Verify semantic relations match source and target node types
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source)!;
      const targetNode = nodeMap.get(edge.target)!;
      expect(sourceNode).toBeDefined();
      expect(targetNode).toBeDefined();

      const relation = edge.data?.relation;
      if (relation === 'routes_to') {
        expect(sourceNode.data.nodeType).toBe('route');
        expect(['page', 'component']).toContain(targetNode.data.nodeType);
      } else if (relation === 'renders') {
        expect(['page', 'component']).toContain(sourceNode.data.nodeType);
        expect(['page', 'component']).toContain(targetNode.data.nodeType);
      } else if (relation === 'triggers') {
        expect(['page', 'component']).toContain(sourceNode.data.nodeType);
        expect(targetNode.data.nodeType).toBe('action');
      } else if (relation === 'uses_hook') {
        expect(['page', 'component']).toContain(sourceNode.data.nodeType);
        expect(targetNode.data.nodeType).toBe('hook');
      } else if (relation === 'accesses_store') {
        expect(['page', 'component']).toContain(sourceNode.data.nodeType);
        expect(targetNode.data.nodeType).toBe('store');
      } else if (relation === 'calls_api') {
        expect(['page', 'component']).toContain(sourceNode.data.nodeType);
        expect(targetNode.data.nodeType).toBe('api');
      }
    }
  });

  it('maintains graph closure in collapsed-by-default view', () => {
    const { nodes, edges } = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set());
    expect(nodes.length).toBeGreaterThan(0);
    assertGraphClosure(nodes, edges);
  });

  it('maintains graph closure across multiple expansion subsets', () => {
    for (const page of analysis.pages) {
      const pageId = `node-page-${page.id}`;
      const { nodes, edges } = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set([pageId]));
      assertGraphClosure(nodes, edges);
    }
  });

  it('prevents dangling edges when analysis references phantom or nonexistent targets', () => {
    const corruptAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [
        {
          id: 'r-ghost',
          path: '/ghost',
          pageComponentName: 'NonExistentPage',
          filePath: 'src/App.tsx',
        },
      ],
      pages: [
        {
          id: 'p-real',
          name: 'RealPage',
          filePath: 'src/RealPage.tsx',
          isPage: true,
          isExported: true,
          childrenNames: ['PhantomChild1', 'PhantomChild2'],
          actions: [],
          hooks: [],
          stores: [],
          apiCalls: [],
          props: [],
          wireframe: [],
          codeSnippet: '',
        },
      ],
      components: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 1,
    };

    const { nodes, edges } = buildGraphFromAnalysis(corruptAnalysis);
    // Phantom targets should not produce dangling edges
    expect(edges).toHaveLength(0);
    expect(nodes).toHaveLength(2); // route and page exist
    assertGraphClosure(nodes, edges);
  });
});

describe('Graph Invariants: Filter Consistency and Edge Integrity', () => {
  const demoFiles = createDemoProjectFiles();
  const analysis = analyzeProject(demoFiles);

  const filterKeys: Array<{
    key: keyof GraphFilterState;
    nodeType: string;
    relation?: FlowUIEdgeRelation;
  }> = [
    { key: 'showRoutes', nodeType: 'route', relation: 'routes_to' },
    { key: 'showPages', nodeType: 'page' },
    { key: 'showComponents', nodeType: 'component', relation: 'renders' },
    { key: 'showActions', nodeType: 'action', relation: 'triggers' },
    { key: 'showHooks', nodeType: 'hook', relation: 'uses_hook' },
    { key: 'showStores', nodeType: 'store', relation: 'accesses_store' },
    { key: 'showApis', nodeType: 'api', relation: 'calls_api' },
  ];

  for (const { key, nodeType, relation } of filterKeys) {
    it(`excludes ${nodeType} nodes and maintains closure when ${key} is false`, () => {
      const filters: Partial<GraphFilterState> = { [key]: false };
      const { nodes, edges } = buildGraphFromAnalysis(analysis, filters);

      // Verify node type is completely absent
      const matchingNodes = nodes.filter((n) => n.data.nodeType === nodeType);
      expect(matchingNodes).toHaveLength(0);

      // Verify incident edges for this type are absent
      if (relation) {
        const matchingEdges = edges.filter((e) => e.data?.relation === relation);
        expect(matchingEdges).toHaveLength(0);
      }

      // Verify overall graph closure is preserved
      assertGraphClosure(nodes, edges);
    });
  }

  it('handles isolated routes view when all containers are filtered out', () => {
    const filters: Partial<GraphFilterState> = {
      showRoutes: true,
      showPages: false,
      showComponents: false,
      showActions: false,
      showHooks: false,
      showStores: false,
      showApis: false,
    };

    const { nodes, edges } = buildGraphFromAnalysis(analysis, filters);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.data.nodeType === 'route')).toBe(true);
    // Since pages and components are excluded, route edges cannot connect to anything
    expect(edges).toHaveLength(0);
    assertGraphClosure(nodes, edges);
  });

  it('handles all filters disabled gracefully without crashing', () => {
    const filters: Partial<GraphFilterState> = {
      showRoutes: false,
      showPages: false,
      showComponents: false,
      showActions: false,
      showHooks: false,
      showStores: false,
      showApis: false,
    };

    const { nodes, edges } = buildGraphFromAnalysis(analysis, filters);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
    assertGraphClosure(nodes, edges);
  });
});

describe('Graph Invariants: Determinism, Idempotency and Deduplication', () => {
  const demoFiles = createDemoProjectFiles();
  const analysis = analyzeProject(demoFiles);

  it('is strictly idempotent: repeated executions produce identical node and edge topologies', () => {
    const run1 = buildGraphFromAnalysis(analysis);
    const run2 = buildGraphFromAnalysis(analysis);
    const run3 = buildGraphFromAnalysis(analysis);

    // Deep equality of nodes and edges across runs
    expect(run1.nodes).toEqual(run2.nodes);
    expect(run2.nodes).toEqual(run3.nodes);

    expect(run1.edges).toEqual(run2.edges);
    expect(run2.edges).toEqual(run3.edges);

    // Coordinate exactness
    for (let i = 0; i < run1.nodes.length; i++) {
      expect(run1.nodes[i].position.x).toBe(run2.nodes[i].position.x);
      expect(run1.nodes[i].position.y).toBe(run2.nodes[i].position.y);
    }
  });

  it('strictly enforces unique node IDs and unique edge IDs', () => {
    const { nodes, edges } = buildGraphFromAnalysis(analysis);

    const nodeIds = nodes.map((n) => n.id);
    expect(new Set(nodeIds).size).toBe(nodes.length);

    const edgeIds = edges.map((e) => e.id);
    expect(new Set(edgeIds).size).toBe(edges.length);
  });

  it('prohibits duplicate edges between identical node pairs with the same relation', () => {
    const { edges } = buildGraphFromAnalysis(analysis);
    const edgeSignatures = new Set<string>();

    for (const edge of edges) {
      const signature = `${edge.source}->${edge.target}:${edge.data?.relation}`;
      expect(edgeSignatures.has(signature)).toBe(false);
      edgeSignatures.add(signature);
    }
  });

  it('deduplicates duplicate children and interactions in the analysis without corrupting topology', () => {
    const duplicatedAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [
        { id: 'r1', path: '/home', pageComponentName: 'Home', filePath: 'src/App.tsx' },
        { id: 'r1', path: '/home', pageComponentName: 'Home', filePath: 'src/App.tsx' }, // Duplicate route ID
      ],
      pages: [
        {
          id: 'p1',
          name: 'Home',
          filePath: 'src/Home.tsx',
          isPage: true,
          isExported: true,
          childrenNames: ['Card', 'Card', 'Card'], // Duplicate child names
          actions: [
            {
              id: 'a1',
              name: 'handleClick',
              trigger: 'onClick',
              componentName: 'Home',
              filePath: 'src/Home.tsx',
              codeSnippet: '',
              apiCalls: [],
              stateUpdates: [],
            },
            {
              id: 'a1',
              name: 'handleClick',
              trigger: 'onClick',
              componentName: 'Home',
              filePath: 'src/Home.tsx',
              codeSnippet: '',
              apiCalls: [],
              stateUpdates: [],
            }, // Duplicate action ID
          ],
          hooks: [
            { id: 'h1', name: 'useState', isCustom: false },
            { id: 'h1', name: 'useState', isCustom: false }, // Duplicate hook ID
          ],
          stores: [
            { id: 's1', storeName: 'useStore', type: 'zustand', properties: [] },
            { id: 's1', storeName: 'useStore', type: 'zustand', properties: [] }, // Duplicate store ID
          ],
          apiCalls: [
            {
              id: 'api1',
              endpoint: '/api/data',
              method: 'GET',
              client: 'fetch',
              callerComponent: 'Home',
              filePath: 'src/Home.tsx',
            },
            {
              id: 'api1',
              endpoint: '/api/data',
              method: 'GET',
              client: 'fetch',
              callerComponent: 'Home',
              filePath: 'src/Home.tsx',
            }, // Duplicate API ID
          ],
          props: [],
          wireframe: [],
          codeSnippet: '',
        },
      ],
      components: [
        {
          id: 'c1',
          name: 'Card',
          filePath: 'src/Card.tsx',
          isPage: false,
          isExported: true,
          childrenNames: [],
          actions: [],
          hooks: [],
          stores: [],
          apiCalls: [],
          props: [],
          wireframe: [],
          codeSnippet: '',
        },
      ],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 2,
    };

    const { nodes, edges } = buildGraphFromAnalysis(duplicatedAnalysis);

    // Node IDs must remain strictly unique
    const nodeIds = nodes.map((n) => n.id);
    expect(new Set(nodeIds).size).toBe(nodes.length);

    // Edge IDs must remain strictly unique
    const edgeIds = edges.map((e) => e.id);
    expect(new Set(edgeIds).size).toBe(edges.length);

    // No edge can connect phantom nodes
    assertGraphClosure(nodes, edges);

    // Dagre coordinates must still be valid
    assertDagreInvariants(nodes);
  });
});
