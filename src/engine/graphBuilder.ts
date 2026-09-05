import dagre from 'dagre';
import type { FlowUINode, FlowUIEdge, GraphFilterState, FlowUIEdgeRelation } from '@/types/graph';
import type { ProjectAnalysis, UIComponent } from '@/types/analysis';

export function buildGraphFromAnalysis(
  analysis: ProjectAnalysis,
  filters?: Partial<GraphFilterState>,
  direction: 'TB' | 'LR' = 'LR'
): { nodes: FlowUINode[]; edges: FlowUIEdge[] } {
  const nodes: FlowUINode[] = [];
  const edges: FlowUIEdge[] = [];
  const addedNodeIds = new Set<string>();

  const showRoutes = filters?.showRoutes ?? true;
  const showPages = filters?.showPages ?? true;
  const showComponents = filters?.showComponents ?? true;
  const showActions = filters?.showActions ?? true;
  const showHooks = filters?.showHooks ?? true;
  const showStores = filters?.showStores ?? true;
  const showApis = filters?.showApis ?? true;
  const searchQuery = (filters?.searchQuery || '').toLowerCase().trim();

  // Helper to add nodes without duplication
  function addNode(node: FlowUINode) {
    if (!addedNodeIds.has(node.id)) {
      addedNodeIds.add(node.id);
      nodes.push(node);
    }
  }

  // Helper to add edges
  function addEdge(source: string, target: string, relation: FlowUIEdgeRelation, label?: string) {
    if (addedNodeIds.has(source) && addedNodeIds.has(target)) {
      edges.push({
        id: `e-${source}-${target}-${relation}`,
        source,
        target,
        type: 'customEdge',
        data: { relation, label },
      });
    }
  }

  const allComponentsMap = new Map<string, UIComponent>();
  for (const p of analysis.pages) allComponentsMap.set(p.name, p);
  for (const c of analysis.components) allComponentsMap.set(c.name, c);

  // 1. Build Route Nodes
  if (showRoutes) {
    for (const route of analysis.routes) {
      const routeNodeId = `node-route-${route.id}`;
      addNode({
        id: routeNodeId,
        type: 'route',
        position: { x: 0, y: 0 },
        data: {
          id: routeNodeId,
          label: route.path,
          nodeType: 'route',
          route,
          filePath: route.filePath,
          layoutDirection: direction,
          codeSnippet: `// Rota da Aplicação Frontend\nPath: "${route.path}"\nRenderiza Componente: <${route.pageComponentName} />`,
        },
      });
    }
  }

  // 2. Build Page Nodes & link from Routes
  if (showPages) {
    for (const page of analysis.pages) {
      const pageNodeId = `node-page-${page.id}`;
      addNode({
        id: pageNodeId,
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          id: pageNodeId,
          label: page.name,
          nodeType: 'page',
          page,
          childrenCount: page.childrenNames.length,
          filePath: page.filePath,
          codeSnippet: page.codeSnippet,
          layoutDirection: direction,
        },
      });

      // Link corresponding routes to this page
      if (showRoutes) {
        for (const route of analysis.routes) {
          if (route.pageComponentName === page.name) {
            addEdge(`node-route-${route.id}`, pageNodeId, 'routes_to', 'renders');
          }
        }
      }
    }
  }

  // 3. Build Component Nodes & link hierarchy
  if (showComponents) {
    for (const comp of analysis.components) {
      const compNodeId = `node-comp-${comp.id}`;
      addNode({
        id: compNodeId,
        type: 'component',
        position: { x: 0, y: 0 },
        data: {
          id: compNodeId,
          label: comp.name,
          nodeType: 'component',
          component: comp,
          isExpanded: true,
          actionsCount: comp.actions.length,
          hooksCount: comp.hooks.length,
          filePath: comp.filePath,
          codeSnippet: comp.codeSnippet,
          layoutDirection: direction,
        },
      });
    }

    // Link parent components/pages to child components
    const allContainers = [...analysis.pages, ...analysis.components];
    for (const parent of allContainers) {
      const parentNodeId = parent.isPage ? `node-page-${parent.id}` : `node-comp-${parent.id}`;
      for (const childName of parent.childrenNames) {
        const childComp = allComponentsMap.get(childName);
        if (childComp) {
          const childNodeId = childComp.isPage ? `node-page-${childComp.id}` : `node-comp-${childComp.id}`;
          addEdge(parentNodeId, childNodeId, 'renders', 'renders');
        }
      }
    }
  }

  // 4. Build Actions, Hooks, Stores, APIs for visible components
  const visibleComponents = [
    ...(showPages ? analysis.pages : []),
    ...(showComponents ? analysis.components : []),
  ];

  for (const comp of visibleComponents) {
    const parentNodeId = comp.isPage ? `node-page-${comp.id}` : `node-comp-${comp.id}`;

    // Actions
    if (showActions) {
      for (const action of comp.actions) {
        const actionNodeId = `node-action-${action.id}`;
        addNode({
          id: actionNodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: {
            id: actionNodeId,
            label: `${action.trigger}: ${action.name}`,
            nodeType: 'action',
            action,
            filePath: action.filePath,
            codeSnippet: action.codeSnippet,
            layoutDirection: direction,
          },
        });
        addEdge(parentNodeId, actionNodeId, 'triggers', 'handles');
      }
    }

    // Hooks
    if (showHooks) {
      for (const hook of comp.hooks) {
        const hookNodeId = `node-hook-${hook.id}`;
        addNode({
          id: hookNodeId,
          type: 'hook',
          position: { x: 0, y: 0 },
          data: {
            id: hookNodeId,
            label: hook.name,
            nodeType: 'hook',
            hook,
            layoutDirection: direction,
            codeSnippet: `// Hook ${hook.isCustom ? 'Customizado' : 'React/Vue'}\nconst result = ${hook.name}();`,
          },
        });
        addEdge(parentNodeId, hookNodeId, 'uses_hook', 'uses');
      }
    }

    // Stores
    if (showStores) {
      for (const store of comp.stores) {
        const storeNodeId = `node-store-${store.id}`;
        addNode({
          id: storeNodeId,
          type: 'store',
          position: { x: 0, y: 0 },
          data: {
            id: storeNodeId,
            label: store.storeName,
            nodeType: 'store',
            store,
            layoutDirection: direction,
            codeSnippet: `// Estado Global (${store.type || 'Zustand/Pinia'})\nconst ${store.storeName} = use${store.storeName}();`,
          },
        });
        addEdge(parentNodeId, storeNodeId, 'accesses_store', 'state');
      }
    }

    // APIs
    if (showApis) {
      for (const api of comp.apiCalls) {
        const apiNodeId = `node-api-${api.id}`;
        addNode({
          id: apiNodeId,
          type: 'api',
          position: { x: 0, y: 0 },
          data: {
            id: apiNodeId,
            label: `${api.method} ${api.endpoint}`,
            nodeType: 'api',
            apiCall: api,
            filePath: api.filePath,
            layoutDirection: direction,
            codeSnippet: `// Chamada de API em <${api.callerComponent || 'Component'} />\n// Método: ${api.method} | Cliente: ${api.client || 'fetch'}\n${api.client || 'fetch'}('${api.endpoint}', { method: '${api.method}' });`,
          },
        });
        addEdge(parentNodeId, apiNodeId, 'calls_api', 'calls');
      }
    }
  }

  // 5. Run Dagre Auto-Layout
  if (nodes.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      ranksep: 90,
      nodesep: 50,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of nodes) {
      const dims = getNodeDimensions(node.data.nodeType);
      g.setNode(node.id, { width: dims.width, height: dims.height });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    for (const node of nodes) {
      const nodeWithPos = g.node(node.id);
      if (nodeWithPos) {
        const dims = getNodeDimensions(node.data.nodeType);
        node.position = {
          x: nodeWithPos.x - dims.width / 2,
          y: nodeWithPos.y - dims.height / 2,
        };
      }
    }
  }

  // 6. Apply search match and dimming flags
  const hasSearch = Boolean(searchQuery);
  const matchingNodeIds = new Set<string>();

  for (const node of nodes) {
    if (hasSearch) {
      const isMatch =
        node.data.label.toLowerCase().includes(searchQuery) ||
        node.data.nodeType.toLowerCase().includes(searchQuery) ||
        Boolean(node.data.filePath && node.data.filePath.toLowerCase().includes(searchQuery));
      node.data.isSearchMatch = isMatch;
      node.data.isDimmed = !isMatch;
      if (isMatch) {
        matchingNodeIds.add(node.id);
      }
    } else {
      node.data.isSearchMatch = false;
      node.data.isDimmed = false;
    }
  }

  // Dim edges if search is active and edge does not connect to any matching node
  for (const edge of edges) {
    if (hasSearch && matchingNodeIds.size > 0) {
      const isConnectedToMatch = matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target);
      edge.data = {
        ...edge.data,
        relation: edge.data?.relation || 'renders',
        isDimmed: !isConnectedToMatch,
      };
    } else {
      if (edge.data) {
        edge.data.isDimmed = false;
      }
    }
  }

  return { nodes, edges };
}

function getNodeDimensions(type: string): { width: number; height: number } {
  switch (type) {
    case 'route':
      return { width: 200, height: 60 };
    case 'page':
      return { width: 240, height: 74 };
    case 'component':
      return { width: 260, height: 110 };
    case 'action':
      return { width: 200, height: 50 };
    case 'hook':
      return { width: 170, height: 46 };
    case 'store':
      return { width: 190, height: 52 };
    case 'api':
      return { width: 220, height: 56 };
    default:
      return { width: 200, height: 60 };
  }
}
