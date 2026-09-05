import { describe, it, expect, beforeEach } from 'vitest';
import { createDemoProjectFiles } from '@/services/demoProject';
import { analyzeProject } from '@/engine/analyzers';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { useGraphStore } from '@/stores/graphStore';

describe('Collapsed by Default and Dynamic Expand/Collapse', () => {
  const demoFiles = createDemoProjectFiles();
  const analysis = analyzeProject(demoFiles);

  beforeEach(() => {
    useGraphStore.getState().reset();
  });

  it('opens graph collapsed by default with only high-level entry points', () => {
    // When expandedNodeIds is an empty set (the default when loading project):
    const collapsed = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set());

    // Should only show routes and pages (entry points)
    const nodeTypes = new Set(collapsed.nodes.map((n) => n.data.nodeType));
    expect(nodeTypes.has('route')).toBe(true);
    expect(nodeTypes.has('page')).toBe(true);
    // Detail nodes should NOT be present initially
    expect(nodeTypes.has('action')).toBe(false);
    expect(nodeTypes.has('hook')).toBe(false);

    // Number of nodes in collapsed view should be significantly lower than full view
    const full = buildGraphFromAnalysis(analysis); // full expansion
    expect(collapsed.nodes.length).toBeLessThan(full.nodes.length / 2);

    // Every page node should have isExpanded = false and children counts
    const pageNodes = collapsed.nodes.filter((n) => n.data.nodeType === 'page');
    for (const page of pageNodes) {
      expect(page.data.isExpanded).toBe(false);
      expect(typeof page.data.totalChildrenCount).toBe('number');
      expect(page.data.hasChildren).toBe(true);
      expect((page.data.totalChildrenCount as number)).toBeGreaterThan(0);
    }
  });

  it('reveals immediate child components and actions when a node is expanded', () => {
    const dashboardPage = analysis.pages.find((p) => p.name === 'DashboardPage')!;
    const dashboardNodeId = `node-page-${dashboardPage.id}`;

    const expandedSet = new Set<string>([dashboardNodeId]);
    const result = buildGraphFromAnalysis(analysis, undefined, 'LR', expandedSet);

    // DashboardPage itself should be marked as isExpanded = true
    const dashboardNode = result.nodes.find((n) => n.id === dashboardNodeId);
    expect(dashboardNode).toBeDefined();
    expect(dashboardNode?.data.isExpanded).toBe(true);

    // Immediate children of DashboardPage should now be present
    for (const childName of dashboardPage.childrenNames) {
      const childInGraph = result.nodes.find((n) => n.data.label === childName);
      expect(childInGraph).toBeDefined();
      // But child components themselves must be collapsed!
      expect(childInGraph?.data.isExpanded).toBe(false);
    }

    // Actions of DashboardPage should now be present
    for (const action of dashboardPage.actions) {
      const actionNode = result.nodes.find((n) => n.id === `node-action-${action.id}`);
      expect(actionNode).toBeDefined();
    }

    // Other pages (e.g. LoginPage) remain collapsed
    const loginNode = result.nodes.find((n) => n.data.label === 'LoginPage');
    expect(loginNode?.data.isExpanded).toBe(false);
  });

  it('hides child components when node is collapsed back', () => {
    const dashboardPage = analysis.pages.find((p) => p.name === 'DashboardPage')!;
    const dashboardNodeId = `node-page-${dashboardPage.id}`;

    // 1. Expand
    const expanded = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set([dashboardNodeId]));
    expect(expanded.nodes.some((n) => n.data.label === 'MetricsCard')).toBe(true);

    // 2. Collapse
    const collapsedAgain = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set());
    expect(collapsedAgain.nodes.some((n) => n.data.label === 'MetricsCard')).toBe(false);
  });

  it('manages expand/collapse through useGraphStore methods', () => {
    const store = useGraphStore.getState();
    store.buildGraph(analysis);

    // Initial state: Level 1 (collapsed by default)
    expect(useGraphStore.getState().expansionLevel).toBe(1);
    expect(useGraphStore.getState().expandedNodeIds.size).toBe(0);

    const initialCount = useGraphStore.getState().nodes.length;

    // Toggle expand first page
    const firstPage = analysis.pages[0];
    const pageNodeId = `node-page-${firstPage.id}`;
    useGraphStore.getState().toggleNodeExpanded(pageNodeId);

    expect(useGraphStore.getState().expandedNodeIds.has(pageNodeId)).toBe(true);
    expect(useGraphStore.getState().nodes.length).toBeGreaterThan(initialCount);

    // Toggle collapse same page
    useGraphStore.getState().toggleNodeExpanded(pageNodeId);
    expect(useGraphStore.getState().expandedNodeIds.has(pageNodeId)).toBe(false);
    expect(useGraphStore.getState().nodes.length).toBe(initialCount);
  });

  it('supports depth level selectors and expandAll / collapseAll', () => {
    const store = useGraphStore.getState();
    store.buildGraph(analysis);

    const level1Count = useGraphStore.getState().nodes.length;

    // Level 2: Pages expanded, components collapsed
    useGraphStore.getState().setExpansionLevel(2);
    expect(useGraphStore.getState().expansionLevel).toBe(2);
    const level2Count = useGraphStore.getState().nodes.length;
    expect(level2Count).toBeGreaterThan(level1Count);

    // Level 3: Everything expanded
    useGraphStore.getState().setExpansionLevel(3);
    expect(useGraphStore.getState().expansionLevel).toBe(3);
    const level3Count = useGraphStore.getState().nodes.length;
    expect(level3Count).toBeGreaterThan(level2Count);

    // Collapse All -> Back to level 1
    useGraphStore.getState().collapseAll();
    expect(useGraphStore.getState().expansionLevel).toBe(1);
    expect(useGraphStore.getState().nodes.length).toBe(level1Count);

    // Expand All -> Level 3
    useGraphStore.getState().expandAll();
    expect(useGraphStore.getState().expansionLevel).toBe(3);
    expect(useGraphStore.getState().nodes.length).toBe(level3Count);
  });

  it('auto-expands ancestors when searching for hidden elements', () => {
    // Search for an action that lives inside a collapsed component (e.g. handleSubmit in LoginPage/LoginForm)
    const result = buildGraphFromAnalysis(
      analysis,
      { searchQuery: 'handleSubmit' },
      'LR',
      new Set() // start collapsed
    );

    // Action should be visible and marked as search match
    const actionMatch = result.nodes.find((n) => n.data.nodeType === 'action' && n.data.isSearchMatch);
    expect(actionMatch).toBeDefined();

    // Its parent page should have been auto-expanded
    const parentPage = result.nodes.find((n) => n.data.nodeType === 'page' && n.data.isExpanded);
    expect(parentPage).toBeDefined();
  });

  it('computes valid non-overlapping coordinates in Dagre layout', () => {
    const store = useGraphStore.getState();
    store.buildGraph(analysis);

    const nodes = useGraphStore.getState().nodes;
    for (const node of nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });
});
