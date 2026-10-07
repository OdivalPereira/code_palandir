import { describe, it, expect, beforeEach } from 'vitest';
import { auditGraphForensics } from '@/engine/graphForensics';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { analyzeProject } from '@/engine/analyzers';
import { createDemoProjectFiles } from '@/services/demoProject';
import { useGraphStore } from '@/stores/graphStore';
import type { FlowUINode, FlowUIEdge, UINodeType, FlowUIEdgeRelation } from '@/types/graph';

function createMockNode(id: string, nodeType: UINodeType = 'component', label = id): FlowUINode {
  return {
    id,
    type: nodeType,
    position: { x: 0, y: 0 },
    data: {
      id,
      label,
      nodeType,
    } as any,
  };
}

function createMockEdge(
  id: string,
  source: string,
  target: string,
  relation: FlowUIEdgeRelation = 'renders'
): FlowUIEdge {
  return {
    id,
    source,
    target,
    type: 'customEdge',
    data: {
      relation,
    },
  };
}

describe('Graph Forensics: Empty Graph Scenarios', () => {
  it('correctly handles an empty graph without error and reports validity', () => {
    const report = auditGraphForensics([], []);

    expect(report.isValid).toBe(true);
    expect(report.nodeCount).toBe(0);
    expect(report.edgeCount).toBe(0);
    expect(report.density).toBe(0);
    expect(report.findings).toHaveLength(0);
    expect(report.metrics).toEqual({
      rootsCount: 0,
      leavesCount: 0,
      isolatedNodesCount: 0,
      cyclesCount: 0,
    });
    expect(typeof report.timestamp).toBe('string');
    expect(new Date(report.timestamp).getTime()).not.toBeNaN();
  });
});

describe('Graph Forensics: Valid Graph Topologies', () => {
  it('audits a valid linear DAG without findings and computes correct metrics and density', () => {
    // Route -> Page -> Component -> Action
    const nodes: FlowUINode[] = [
      createMockNode('route-home', 'route', '/home'),
      createMockNode('page-home', 'page', 'HomePage'),
      createMockNode('comp-card', 'component', 'Card'),
      createMockNode('action-click', 'action', 'onClick'),
    ];

    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'route-home', 'page-home', 'routes_to'),
      createMockEdge('e2', 'page-home', 'comp-card', 'renders'),
      createMockEdge('e3', 'comp-card', 'action-click', 'triggers'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(true);
    expect(report.nodeCount).toBe(4);
    expect(report.edgeCount).toBe(3);
    // Density: 3 / (4 * 3) = 3 / 12 = 0.25
    expect(report.density).toBe(0.25);
    expect(report.findings).toHaveLength(0);
    expect(report.metrics).toEqual({
      rootsCount: 1, // route-home (in=0, out=1)
      leavesCount: 1, // action-click (in=1, out=0)
      isolatedNodesCount: 0,
      cyclesCount: 0,
    });
  });

  it('audits a branching UI tree with multiple leaves and intermediate nodes', () => {
    // page -> [compA, compB]
    // compA -> actionA
    // compB -> storeB
    const nodes: FlowUINode[] = [
      createMockNode('page-root', 'page'),
      createMockNode('comp-a', 'component'),
      createMockNode('comp-b', 'component'),
      createMockNode('action-a', 'action'),
      createMockNode('store-b', 'store'),
    ];

    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'page-root', 'comp-a', 'renders'),
      createMockEdge('e2', 'page-root', 'comp-b', 'renders'),
      createMockEdge('e3', 'comp-a', 'action-a', 'triggers'),
      createMockEdge('e4', 'comp-b', 'store-b', 'accesses_store'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(true);
    expect(report.nodeCount).toBe(5);
    expect(report.edgeCount).toBe(4);
    // Density: 4 / (5 * 4) = 4 / 20 = 0.2
    expect(report.density).toBe(0.2);
    expect(report.findings).toHaveLength(0);
    expect(report.metrics.rootsCount).toBe(1); // page-root
    expect(report.metrics.leavesCount).toBe(2); // action-a, store-b
    expect(report.metrics.isolatedNodesCount).toBe(0);
    expect(report.metrics.cyclesCount).toBe(0);
  });

  it('audits real Code Palandir demo project analysis and confirms logical graph integrity', () => {
    const files = createDemoProjectFiles();
    const analysis = analyzeProject(files);
    const { nodes, edges } = buildGraphFromAnalysis(analysis);

    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(true);
    expect(report.nodeCount).toBe(nodes.length);
    expect(report.edgeCount).toBe(edges.length);
    expect(report.density).toBeGreaterThan(0);
    expect(report.density).toBeLessThan(1);

    // No severe errors permitted in standard demo project graph
    const errorFindings = report.findings.filter((f) => f.severity === 'error');
    expect(errorFindings).toHaveLength(0);
    expect(report.metrics.cyclesCount).toBe(0);
  });
});

describe('Graph Forensics: Phantom Node Detection (PHANTOM_EDGE)', () => {
  it('flags an edge referencing a nonexistent target node as PHANTOM_EDGE error', () => {
    const nodes: FlowUINode[] = [createMockNode('node-1')];
    const edges: FlowUIEdge[] = [createMockEdge('e-phantom-target', 'node-1', 'node-ghost')];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    const phantom = report.findings.find((f) => f.code === 'PHANTOM_EDGE');
    expect(phantom).toBeDefined();
    expect(phantom?.severity).toBe('error');
    expect(phantom?.edgeIds).toContain('e-phantom-target');
    expect(phantom?.nodeIds).toContain('node-ghost');
    expect(phantom?.message).toContain('node-ghost');
  });

  it('flags an edge referencing a nonexistent source node as PHANTOM_EDGE error', () => {
    const nodes: FlowUINode[] = [createMockNode('node-2')];
    const edges: FlowUIEdge[] = [createMockEdge('e-phantom-source', 'node-ghost', 'node-2')];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    const phantom = report.findings.find((f) => f.code === 'PHANTOM_EDGE');
    expect(phantom).toBeDefined();
    expect(phantom?.severity).toBe('error');
    expect(phantom?.edgeIds).toContain('e-phantom-source');
    expect(phantom?.nodeIds).toContain('node-ghost');
  });

  it('flags an edge referencing both nonexistent source and target nodes', () => {
    const nodes: FlowUINode[] = [createMockNode('node-real')];
    const edges: FlowUIEdge[] = [createMockEdge('e-total-phantom', 'ghost-source', 'ghost-target')];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    const phantom = report.findings.find((f) => f.code === 'PHANTOM_EDGE');
    expect(phantom).toBeDefined();
    expect(phantom?.severity).toBe('error');
    expect(phantom?.nodeIds).toContain('ghost-source');
    expect(phantom?.nodeIds).toContain('ghost-target');
  });
});

describe('Graph Forensics: Reflexive Edge Detection (SELF_LOOP)', () => {
  it('detects reflexive self-loops and reports SELF_LOOP error', () => {
    const nodes: FlowUINode[] = [createMockNode('node-a'), createMockNode('node-b')];
    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'node-a', 'node-b'),
      createMockEdge('e-loop', 'node-b', 'node-b'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    const loopFinding = report.findings.find((f) => f.code === 'SELF_LOOP');
    expect(loopFinding).toBeDefined();
    expect(loopFinding?.severity).toBe('error');
    expect(loopFinding?.nodeIds).toContain('node-b');
    expect(loopFinding?.edgeIds).toContain('e-loop');
    expect(loopFinding?.message).toContain('node-b');
  });
});

describe('Graph Forensics: Directed Cycle Detection (DIRECTED_CYCLE)', () => {
  it('detects a 2-node cycle (A -> B -> A) and extracts cycle path and edges', () => {
    const nodes: FlowUINode[] = [createMockNode('comp-a'), createMockNode('comp-b')];
    const edges: FlowUIEdge[] = [
      createMockEdge('e-ab', 'comp-a', 'comp-b'),
      createMockEdge('e-ba', 'comp-b', 'comp-a'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    expect(report.metrics.cyclesCount).toBe(1);

    const cycleFinding = report.findings.find((f) => f.code === 'DIRECTED_CYCLE');
    expect(cycleFinding).toBeDefined();
    expect(cycleFinding?.severity).toBe('error');
    expect(cycleFinding?.nodeIds).toEqual(expect.arrayContaining(['comp-a', 'comp-b']));
    expect(cycleFinding?.edgeIds).toEqual(expect.arrayContaining(['e-ab', 'e-ba']));
    expect(cycleFinding?.message).toMatch(/comp-a|comp-b/);
  });

  it('detects a 3-node cycle (A -> B -> C -> A) within a larger graph', () => {
    const nodes: FlowUINode[] = [
      createMockNode('page-entry', 'page'),
      createMockNode('node-a', 'component'),
      createMockNode('node-b', 'component'),
      createMockNode('node-c', 'component'),
    ];

    const edges: FlowUIEdge[] = [
      createMockEdge('e-entry', 'page-entry', 'node-a'),
      createMockEdge('e1', 'node-a', 'node-b'),
      createMockEdge('e2', 'node-b', 'node-c'),
      createMockEdge('e3', 'node-c', 'node-a'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    expect(report.metrics.cyclesCount).toBe(1);

    const cycleFinding = report.findings.find((f) => f.code === 'DIRECTED_CYCLE');
    expect(cycleFinding).toBeDefined();
    expect(cycleFinding?.nodeIds).toEqual(expect.arrayContaining(['node-a', 'node-b', 'node-c']));
    expect(cycleFinding?.edgeIds).toEqual(expect.arrayContaining(['e1', 'e2', 'e3']));
  });

  it('detects multiple disjoint cycles in independent graph components', () => {
    const nodes: FlowUINode[] = [
      createMockNode('n1'),
      createMockNode('n2'),
      createMockNode('n3'),
      createMockNode('n4'),
    ];

    const edges: FlowUIEdge[] = [
      // Cycle 1: n1 <-> n2
      createMockEdge('e1', 'n1', 'n2'),
      createMockEdge('e2', 'n2', 'n1'),
      // Cycle 2: n3 <-> n4
      createMockEdge('e3', 'n3', 'n4'),
      createMockEdge('e4', 'n4', 'n3'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    expect(report.metrics.cyclesCount).toBe(2);

    const cycleFindings = report.findings.filter((f) => f.code === 'DIRECTED_CYCLE');
    expect(cycleFindings).toHaveLength(2);
  });
});

describe('Graph Forensics: Isolated and Orphan Component Detection (ISOLATED_NODE)', () => {
  it('detects isolated nodes with inDegree=0 and outDegree=0 and issues warnings', () => {
    const nodes: FlowUINode[] = [
      createMockNode('comp-connected-1'),
      createMockNode('comp-connected-2'),
      createMockNode('comp-orphan-1'),
      createMockNode('comp-orphan-2'),
    ];

    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'comp-connected-1', 'comp-connected-2'),
    ];

    const report = auditGraphForensics(nodes, edges);

    // Isolated components are warnings, not fatal errors
    expect(report.isValid).toBe(true);
    expect(report.metrics.isolatedNodesCount).toBe(2);

    const isolatedFindings = report.findings.filter((f) => f.code === 'ISOLATED_NODE');
    expect(isolatedFindings).toHaveLength(2);
    expect(isolatedFindings.every((f) => f.severity === 'warning')).toBe(true);

    const isolatedIds = isolatedFindings.flatMap((f) => f.nodeIds || []);
    expect(isolatedIds).toContain('comp-orphan-1');
    expect(isolatedIds).toContain('comp-orphan-2');
  });

  it('audits single isolated vertex and computes 0 density', () => {
    const nodes: FlowUINode[] = [createMockNode('comp-solo')];
    const report = auditGraphForensics(nodes, []);

    expect(report.isValid).toBe(true);
    expect(report.nodeCount).toBe(1);
    expect(report.edgeCount).toBe(0);
    expect(report.density).toBe(0);
    expect(report.metrics.isolatedNodesCount).toBe(1);
  });
});

describe('Graph Forensics: Parallel Duplicate Edges (DUPLICATE_EDGE)', () => {
  it('detects duplicate parallel edges between identical source and target', () => {
    const nodes: FlowUINode[] = [createMockNode('node-1'), createMockNode('node-2')];
    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'node-1', 'node-2'),
      createMockEdge('e2', 'node-1', 'node-2'),
    ];

    const report = auditGraphForensics(nodes, edges);

    const dupFinding = report.findings.find((f) => f.code === 'DUPLICATE_EDGE');
    expect(dupFinding).toBeDefined();
    expect(dupFinding?.severity).toBe('warning');
    expect(dupFinding?.edgeIds).toEqual(['e1', 'e2']);
    expect(dupFinding?.nodeIds).toEqual(['node-1', 'node-2']);
  });

  it('detects duplicate edge IDs and reports DUPLICATE_EDGE error', () => {
    const nodes: FlowUINode[] = [
      createMockNode('node-1'),
      createMockNode('node-2'),
      createMockNode('node-3'),
    ];
    const edges: FlowUIEdge[] = [
      createMockEdge('e-identical-id', 'node-1', 'node-2'),
      createMockEdge('e-identical-id', 'node-2', 'node-3'),
    ];

    const report = auditGraphForensics(nodes, edges);

    expect(report.isValid).toBe(false);
    const idFindings = report.findings.filter(
      (f) => f.code === 'DUPLICATE_EDGE' && f.severity === 'error'
    );
    expect(idFindings).toHaveLength(1);
    expect(idFindings[0].message).toContain('e-identical-id');
  });
});

describe('Graph Forensics: Algebraic Invariants and Topological Metrics', () => {
  it('calculates exact density for a complete directed graph K3 (|E| / (|V|*(|V|-1)) = 1.0)', () => {
    const nodes: FlowUINode[] = [
      createMockNode('v1'),
      createMockNode('v2'),
      createMockNode('v3'),
    ];

    // All 6 directed edges in K3
    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'v1', 'v2'),
      createMockEdge('e2', 'v2', 'v1'),
      createMockEdge('e3', 'v2', 'v3'),
      createMockEdge('e4', 'v3', 'v2'),
      createMockEdge('e5', 'v3', 'v1'),
      createMockEdge('e6', 'v1', 'v3'),
    ];

    const report = auditGraphForensics(nodes, edges);
    // |V| = 3, max edges = 3 * 2 = 6. Density = 6 / 6 = 1.0
    expect(report.density).toBe(1.0);
  });

  it('satisfies algebraic partition invariant: roots + leaves + isolated + internal = nodeCount for DAG', () => {
    // v1 -> v2 -> v3
    // v4 (isolated)
    const nodes: FlowUINode[] = [
      createMockNode('v1'),
      createMockNode('v2'),
      createMockNode('v3'),
      createMockNode('v4'),
    ];

    const edges: FlowUIEdge[] = [
      createMockEdge('e1', 'v1', 'v2'),
      createMockEdge('e2', 'v2', 'v3'),
    ];

    const report = auditGraphForensics(nodes, edges);

    const roots = report.metrics.rootsCount; // v1 = 1
    const leaves = report.metrics.leavesCount; // v3 = 1
    const isolated = report.metrics.isolatedNodesCount; // v4 = 1
    const internal = 1; // v2 = 1 (in > 0 and out > 0)

    expect(roots + leaves + isolated + internal).toBe(nodes.length);
  });
});

describe('Graph Forensics: Zustand GraphStore Integration (auditIntegrity)', () => {
  beforeEach(() => {
    useGraphStore.getState().reset();
  });

  it('provides auditIntegrity() method on useGraphStore conforming to GraphForensicsReport', () => {
    const store = useGraphStore.getState();
    expect(typeof store.auditIntegrity).toBe('function');

    const emptyReport = store.auditIntegrity();
    expect(emptyReport.isValid).toBe(true);
    expect(emptyReport.nodeCount).toBe(0);
    expect(emptyReport.edgeCount).toBe(0);
    expect(emptyReport.metrics.cyclesCount).toBe(0);
  });

  it('delegates auditIntegrity to auditGraphForensics with current store state after buildGraph', () => {
    const files = createDemoProjectFiles();
    const analysis = analyzeProject(files);

    useGraphStore.getState().buildGraph(analysis);

    const storeState = useGraphStore.getState();
    expect(storeState.nodes.length).toBeGreaterThan(0);

    const report = storeState.auditIntegrity();
    expect(report.isValid).toBe(true);
    expect(report.nodeCount).toBe(storeState.nodes.length);
    expect(report.edgeCount).toBe(storeState.edges.length);
    expect(report.metrics.cyclesCount).toBe(0);
  });
});
