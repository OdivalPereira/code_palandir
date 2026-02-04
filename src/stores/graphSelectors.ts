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
export const selectSelectedNodeIds = (state: GraphState) => state.selectedNodeIds;
export const selectRequestExpandNode = (state: GraphState) => state.requestExpandNode;
export const selectGraphViewMode = (state: GraphState) => state.graphViewMode;
export const selectFlowQuery = (state: GraphState) => state.flowQuery;
export const selectFlowPathNodeIds = (state: GraphState) => state.flowPathNodeIds;
export const selectFlowPathLinkIds = (state: GraphState) => state.flowPathLinkIds;
export const selectStatus = (state: GraphState) => state.status;
export const selectIsAuthenticated = (state: GraphState) => state.isAuthenticated;
export const selectAuthNotice = (state: GraphState) => state.authNotice;
export const selectPromptItems = (state: GraphState) => state.promptItems;
export const selectSearchQuery = (state: GraphState) => state.searchQuery;
export const selectGithubUrl = (state: GraphState) => state.githubUrl;
export const selectIsPromptOpen = (state: GraphState) => state.isPromptOpen;
export const selectSidebarTab = (state: GraphState) => state.sidebarTab;
export const selectSummaryPromptBase = (state: GraphState) => state.summaryPromptBase;
export const selectProjectSummary = (state: GraphState) => state.projectSummary;
export const selectSummaryStatus = (state: GraphState) => state.summaryStatus;
export const selectSummaryError = (state: GraphState) => state.summaryError;
export const selectAiMetrics = (state: GraphState) => state.aiMetrics;
export const selectAiMetricsStatus = (state: GraphState) => state.aiMetricsStatus;
export const selectAiMetricsError = (state: GraphState) => state.aiMetricsError;
export const selectModuleInputs = (state: GraphState) => state.moduleInputs;
export const selectGhostNodes = (state: GraphState) => state.ghostNodes;
export const selectGhostLinks = (state: GraphState) => state.ghostLinks;
export const selectMissingDependencies = (state: GraphState) => state.missingDependencies;
export const selectAllFilePaths = (state: GraphState) => state.allFilePaths;
export const selectSessionId = (state: GraphState) => state.sessionId;
export const selectProjectSignature = (state: GraphState) => state.projectSignature;
export const selectWizardTemplate = (state: GraphState) => state.wizardTemplate;

export const selectNodes = (state: GraphState) => state.nodes;
export const selectLinks = (state: GraphState) => state.links;

import { convertUIGraphToFlatNodes } from '../utils/uiGraphTransformer';
import { UINode } from '../types';

export const selectGraphNodes = createSelector(
  [selectNodes, selectSemanticLinksById, selectGraphViewMode, (state: GraphState) => state.uiGraph, selectMissingDependencies],
  (nodes: FlatNode[], semanticLinksById: Record<string, SemanticLink>, graphViewMode: GraphViewMode, uiGraph: UINode | null, missingDependencies: any[]) => {
    if (graphViewMode === 'ui' && uiGraph) {
      return convertUIGraphToFlatNodes(uiGraph, missingDependencies).nodes;
    }
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
  [selectLinks, selectSemanticLinksById, selectGraphViewMode, (state: GraphState) => state.uiGraph, selectMissingDependencies],
  (links: Link[], semanticLinksById: Record<string, SemanticLink>, graphViewMode: GraphViewMode, uiGraph: UINode | null, missingDependencies: any[]) => {
    if (graphViewMode === 'ui' && uiGraph) {
      return convertUIGraphToFlatNodes(uiGraph, missingDependencies).links;
    }
    return graphViewMode === 'structural' ? links : Object.values(semanticLinksById);
  }
);
