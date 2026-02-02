import { createSelector } from 'reselect';
import { GraphState } from './graphStore';
import { FlatNode, Link, SemanticLink, GraphViewMode } from '../types';

export const selectRootNode = (state: GraphState) => state.rootNode;
export const selectLoadingPaths = (state: GraphState) => state.loadingPaths;
export const selectExpandedDirectories = (state: GraphState) => state.expandedDirectories;
export const selectNodesById = (state: GraphState) => state.nodesById;
export const selectLinksById = (state: GraphState) => state.linksById;
export const selectSemanticLinksById = (state: GraphState) => state.semanticLinksById;
export const selectSelectedNode = (state: GraphState) => state.selectedNode;
export const selectRequestExpandNode = (state: GraphState) => state.requestExpandNode;
export const selectGraphViewMode = (state: GraphState) => state.graphViewMode;
export const selectFlowQuery = (state: GraphState) => state.flowQuery;
export const selectFlowPathNodeIds = (state: GraphState) => state.flowPathNodeIds;
export const selectFlowPathLinkIds = (state: GraphState) => state.flowPathLinkIds;

export const selectNodes = (state: GraphState) => state.nodes;
export const selectLinks = (state: GraphState) => state.links;

export const selectGraphNodes = createSelector(
  [selectNodes, selectSemanticLinksById, selectGraphViewMode],
  (nodes: FlatNode[], semanticLinksById: Record<string, SemanticLink>, graphViewMode: GraphViewMode) => {
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
  [selectLinks, selectSemanticLinksById, selectGraphViewMode],
  (links: Link[], semanticLinksById: Record<string, SemanticLink>, graphViewMode: GraphViewMode) => (
    graphViewMode === 'structural' ? links : Object.values(semanticLinksById)
  )
);
