import { createSelector } from 'reselect';
import { GraphState } from './graphStore';

export const selectRootNode = (state: GraphState) => state.rootNode;
export const selectLoadingPaths = (state: GraphState) => state.loadingPaths;
export const selectExpandedDirectories = (state: GraphState) => state.expandedDirectories;
export const selectNodesById = (state: GraphState) => state.nodesById;
export const selectLinksById = (state: GraphState) => state.linksById;
export const selectSemanticLinksById = (state: GraphState) => state.semanticLinksById;
export const selectSelectedNodeId = (state: GraphState) => state.selectedNodeId;
export const selectRequestExpandNode = (state: GraphState) => state.requestExpandNode;
export const selectGraphViewMode = (state: GraphState) => state.graphViewMode;
export const selectFlowQuery = (state: GraphState) => state.flowQuery;
export const selectFlowPathNodeIds = (state: GraphState) => state.flowPathNodeIds;
export const selectFlowPathLinkIds = (state: GraphState) => state.flowPathLinkIds;

export const selectSelectedNode = createSelector(
  [selectNodesById, selectSelectedNodeId],
  (nodesById, selectedNodeId) => (selectedNodeId ? nodesById[selectedNodeId] ?? null : null)
);

export const selectGraphNodes = createSelector(
  [selectNodesById, selectSemanticLinksById, selectGraphViewMode],
  (nodesById, semanticLinksById, graphViewMode) => {
    const nodes = Object.values(nodesById);
    if (graphViewMode === 'structural') {
      return nodes;
    }
    const nodeIds = new Set<string>();
    Object.values(semanticLinksById).forEach((link) => {
      if (typeof link.source === 'string') nodeIds.add(link.source);
      if (typeof link.target === 'string') nodeIds.add(link.target);
    });
    return nodes.filter((node) => nodeIds.has(node.id));
  }
);

export const selectGraphLinks = createSelector(
  [selectLinksById, selectSemanticLinksById, selectGraphViewMode],
  (linksById, semanticLinksById, graphViewMode) => (
    graphViewMode === 'structural' ? Object.values(linksById) : Object.values(semanticLinksById)
  )
);
