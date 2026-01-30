import { createSelector } from 'reselect';
import { GraphState } from './graphStore';

export const selectRootNode = (state: GraphState) => state.rootNode;
export const selectLoadingPaths = (state: GraphState) => state.loadingPaths;
export const selectExpandedDirectories = (state: GraphState) => state.expandedDirectories;
export const selectNodesById = (state: GraphState) => state.nodesById;
export const selectLinksById = (state: GraphState) => state.linksById;
export const selectSelectedNodeId = (state: GraphState) => state.selectedNodeId;
export const selectRequestExpandNode = (state: GraphState) => state.requestExpandNode;

export const selectSelectedNode = createSelector(
  [selectNodesById, selectSelectedNodeId],
  (nodesById, selectedNodeId) => (selectedNodeId ? nodesById[selectedNodeId] ?? null : null)
);

export const selectGraphNodes = createSelector([selectNodesById], (nodesById) => Object.values(nodesById));

export const selectGraphLinks = createSelector([selectLinksById], (linksById) => Object.values(linksById));
