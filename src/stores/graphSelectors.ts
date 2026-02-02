import { createSelector } from 'reselect';
import { GraphState } from './graphStore';
import { FlatNode, Link, SemanticLink, GraphViewMode } from '../types';

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
  (nodesById: Record<string, FlatNode>, selectedNodeId: string | null) => (selectedNodeId ? nodesById[selectedNodeId] ?? null : null)
);

export const selectGraphNodes = createSelector(
  [selectNodesById, selectSemanticLinksById, selectGraphViewMode],
  (nodesById: Record<string, FlatNode>, semanticLinksById: Record<string, SemanticLink>, graphViewMode: GraphViewMode) => {
    const nodes = Object.values(nodesById);
    if (graphViewMode === 'structural') {
      return nodes;
    }
    const nodeIds = new Set<string>();
    Object.values(semanticLinksById).forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      nodeIds.add(sourceId);
      nodeIds.add(targetId);
    });
    return nodes.filter((node) => nodeIds.has(node.id));
  }
);

export const selectGraphLinks = createSelector(
  [selectLinksById, selectSemanticLinksById, selectGraphViewMode],
  (linksById: Record<string, Link>, semanticLinksById: Record<string, SemanticLink>, graphViewMode: GraphViewMode) => (
    graphViewMode === 'structural' ? Object.values(linksById) : Object.values(semanticLinksById)
  )
);
