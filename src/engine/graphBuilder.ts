import dagre from 'dagre';
import type { FlowUINode, FlowUIEdge, GraphFilterState, FlowUIEdgeRelation } from '@/types/graph';
import type { ProjectAnalysis, UIComponent } from '@/types/analysis';

export function buildGraphFromAnalysis(
  analysis: ProjectAnalysis,
  filters?: Partial<GraphFilterState>,
  direction: 'TB' | 'LR' = 'LR',
  expandedNodeIds?: Set<string>
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

  // If expandedNodeIds is undefined, legacy full-expansion mode is used (all nodes expanded)
  const isExpandedMode = expandedNodeIds !== undefined;
  const activeExpandedNodeIds = new Set<string>(expandedNodeIds || []);

  // Helper to add nodes without duplication
  function addNode(node: FlowUINode) {
    if (!addedNodeIds.has(node.id)) {
      addedNodeIds.add(node.id);
      nodes.push(node);
    }
  }

  // Helper to add edges without duplication
  const addedEdgeIds = new Set<string>();
  function addEdge(source: string, target: string, relation: FlowUIEdgeRelation, label?: string) {
    if (addedNodeIds.has(source) && addedNodeIds.has(target)) {
      const edgeId = `e-${source}-${target}-${relation}`;
      if (!addedEdgeIds.has(edgeId)) {
        addedEdgeIds.add(edgeId);
        edges.push({
          id: edgeId,
          source,
          target,
          type: 'customEdge',
          data: { relation, label },
        });
      }
    }
  }

  const allComponentsMap = new Map<string, UIComponent>();
  const containerMapByNodeId = new Map<string, UIComponent>();

  for (const p of analysis.pages) {
    allComponentsMap.set(p.name, p);
    containerMapByNodeId.set(`node-page-${p.id}`, p);
  }
  for (const c of analysis.components) {
    allComponentsMap.set(c.name, c);
    containerMapByNodeId.set(`node-comp-${c.id}`, c);
  }

  // Map of child component name -> list of parent node IDs that render it
  const childToParentNodeIds = new Map<string, string[]>();
  for (const p of analysis.pages) {
    const parentNodeId = `node-page-${p.id}`;
    for (const child of p.childrenNames) {
      const list = childToParentNodeIds.get(child) || [];
      list.push(parentNodeId);
      childToParentNodeIds.set(child, list);
    }
  }
  for (const c of analysis.components) {
    const parentNodeId = `node-comp-${c.id}`;
    for (const child of c.childrenNames) {
      const list = childToParentNodeIds.get(child) || [];
      list.push(parentNodeId);
      childToParentNodeIds.set(child, list);
    }
  }

  // Determine root/entry point components (components not rendered by any other page or component)
  const allRenderedChildNames = new Set<string>();
  for (const [childName] of childToParentNodeIds) {
    allRenderedChildNames.add(childName);
  }
  const rootComponents = analysis.components.filter(
    (c) => !allRenderedChildNames.has(c.name)
  );

  // If search query is present, auto-expand ancestors of matching items so matches are visible
  if (searchQuery && isExpandedMode) {
    const expandAncestors = (compName: string) => {
      const parents = childToParentNodeIds.get(compName) || [];
      for (const parentId of parents) {
        if (!activeExpandedNodeIds.has(parentId)) {
          activeExpandedNodeIds.add(parentId);
          const parentComp = containerMapByNodeId.get(parentId);
          if (parentComp) {
            expandAncestors(parentComp.name);
          }
        }
      }
    };

    const allContainers = [...analysis.pages, ...analysis.components];
    for (const comp of allContainers) {
      const nodeId = comp.isPage ? `node-page-${comp.id}` : `node-comp-${comp.id}`;
      // Check if child elements match search
      const actionMatch = comp.actions.some(
        (a) => a.name.toLowerCase().includes(searchQuery) || a.trigger.toLowerCase().includes(searchQuery)
      );
      const storeMatch = comp.stores.some((s) => s.storeName.toLowerCase().includes(searchQuery));
      const apiMatch = comp.apiCalls.some(
        (api) => api.endpoint.toLowerCase().includes(searchQuery) || api.method.toLowerCase().includes(searchQuery)
      );
      const hookMatch = comp.hooks.some((h) => h.name.toLowerCase().includes(searchQuery));
      const compSelfMatch = comp.name.toLowerCase().includes(searchQuery);

      if (actionMatch || storeMatch || apiMatch || hookMatch) {
        activeExpandedNodeIds.add(nodeId);
        expandAncestors(comp.name);
      } else if (compSelfMatch) {
        expandAncestors(comp.name);
      }
    }
  }

  // Determine which container nodes (pages and components) are visible
  const visibleContainerIds = new Set<string>();
  const queue: string[] = [];

  // 1. Add Entry Points
  if (showPages) {
    for (const page of analysis.pages) {
      const pageNodeId = `node-page-${page.id}`;
      visibleContainerIds.add(pageNodeId);
      queue.push(pageNodeId);
    }
  }

  // If there are no pages, add root entry components
  if (showComponents && analysis.pages.length === 0) {
    const entryRootComponents = rootComponents.length > 0 ? rootComponents : analysis.components.slice(0, 1);
    for (const rootComp of entryRootComponents) {
      const compNodeId = `node-comp-${rootComp.id}`;
      if (!visibleContainerIds.has(compNodeId)) {
        visibleContainerIds.add(compNodeId);
        queue.push(compNodeId);
      }
    }
  }

  // 2. Expand hierarchy
  if (!isExpandedMode) {
    // Legacy / Full-expansion mode: all pages and components are visible
    if (showComponents) {
      for (const comp of analysis.components) {
        visibleContainerIds.add(`node-comp-${comp.id}`);
      }
    }
  } else {
    // Collapsed-by-default BFS: only containers that are expanded reveal their direct child components
    while (queue.length > 0) {
      const parentNodeId = queue.shift()!;
      if (activeExpandedNodeIds.has(parentNodeId)) {
        const parentComp = containerMapByNodeId.get(parentNodeId);
        if (parentComp && showComponents) {
          for (const childName of parentComp.childrenNames) {
            const childComp = allComponentsMap.get(childName);
            if (childComp) {
              const childNodeId = childComp.isPage ? `node-page-${childComp.id}` : `node-comp-${childComp.id}`;
              if (!visibleContainerIds.has(childNodeId)) {
                visibleContainerIds.add(childNodeId);
                queue.push(childNodeId);
              }
            }
          }
        }
      }
    }

    // If fully expanded (Level 3 or all containers marked expanded), make sure all components are visible
    const totalContainers = analysis.pages.length + analysis.components.length;
    if (totalContainers > 0 && activeExpandedNodeIds.size >= totalContainers && showComponents) {
      for (const comp of analysis.components) {
        visibleContainerIds.add(`node-comp-${comp.id}`);
      }
    }
  }

  // 3. Build Route Nodes
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

      // Link route to page or entry component if target is visible
      const targetComp = allComponentsMap.get(route.pageComponentName);
      if (targetComp) {
        const targetNodeId = targetComp.isPage ? `node-page-${targetComp.id}` : `node-comp-${targetComp.id}`;
        if (visibleContainerIds.has(targetNodeId)) {
          addEdge(routeNodeId, targetNodeId, 'routes_to', 'renders');
        }
      }
    }
  }

  // 4. Build Page & Component Nodes with children counts and expand state
  for (const containerNodeId of visibleContainerIds) {
    const comp = containerMapByNodeId.get(containerNodeId);
    if (!comp) continue;

    // Calculate direct child counts
    const directChildComponents = comp.childrenNames
      .map((name) => allComponentsMap.get(name))
      .filter(Boolean) as UIComponent[];

    const childComponentsCount = directChildComponents.length;
    const actionsCount = comp.actions.length;
    const apisCount = comp.apiCalls.length;
    const storesCount = comp.stores.length;
    const hooksCount = comp.hooks.length;

    const totalChildrenCount =
      childComponentsCount +
      (showActions ? actionsCount : 0) +
      (showStores ? storesCount : 0) +
      (showApis ? apisCount : 0) +
      (showHooks ? hooksCount : 0);

    const hasChildren = totalChildrenCount > 0;
    const isExpanded = isExpandedMode ? activeExpandedNodeIds.has(containerNodeId) : true;

    if (comp.isPage && showPages) {
      addNode({
        id: containerNodeId,
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          id: containerNodeId,
          label: comp.name,
          nodeType: 'page',
          page: comp,
          childrenCount: childComponentsCount,
          actionsCount,
          apisCount,
          storesCount,
          hooksCount,
          totalChildrenCount,
          hasChildren,
          isExpanded,
          filePath: comp.filePath,
          codeSnippet: comp.codeSnippet,
          layoutDirection: direction,
        },
      });
    } else if (!comp.isPage && showComponents) {
      addNode({
        id: containerNodeId,
        type: 'component',
        position: { x: 0, y: 0 },
        data: {
          id: containerNodeId,
          label: comp.name,
          nodeType: 'component',
          component: comp,
          childrenCount: childComponentsCount,
          actionsCount,
          apisCount,
          storesCount,
          hooksCount,
          totalChildrenCount,
          hasChildren,
          isExpanded,
          filePath: comp.filePath,
          codeSnippet: comp.codeSnippet,
          layoutDirection: direction,
        },
      });
    }

    // If container is expanded, reveal its direct child components, actions, stores, APIs, hooks
    if (isExpanded) {
      // Direct child component edges
      if (showComponents) {
        for (const childComp of directChildComponents) {
          const childNodeId = childComp.isPage ? `node-page-${childComp.id}` : `node-comp-${childComp.id}`;
          if (visibleContainerIds.has(childNodeId)) {
            addEdge(containerNodeId, childNodeId, 'renders', 'renders');
          }
        }
      }

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
          addEdge(containerNodeId, actionNodeId, 'triggers', 'handles');
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
          addEdge(containerNodeId, hookNodeId, 'uses_hook', 'uses');
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
          addEdge(containerNodeId, storeNodeId, 'accesses_store', 'state');
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
          addEdge(containerNodeId, apiNodeId, 'calls_api', 'calls');
        }
      }
    }
  }

  // 5. Run Dagre Auto-Layout on visible nodes & edges
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
      return { width: 210, height: 64 };
    case 'page':
      return { width: 260, height: 96 };
    case 'component':
      return { width: 270, height: 125 };
    case 'action':
      return { width: 200, height: 52 };
    case 'hook':
      return { width: 170, height: 46 };
    case 'store':
      return { width: 190, height: 52 };
    case 'api':
      return { width: 220, height: 56 };
    default:
      return { width: 210, height: 60 };
  }
}
