import type { Node, Edge } from '@xyflow/react';
import type { UIComponent, ComponentAction, ComponentHook, ComponentStoreAccess, ApiCall, UIRoute } from './analysis';

export type UINodeType =
  | 'route'
  | 'page'
  | 'component'
  | 'action'
  | 'hook'
  | 'store'
  | 'api';

export interface BaseNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  nodeType: UINodeType;
  filePath?: string;
  codeSnippet?: string;
  isSelectedForPrompt?: boolean;
  expanded?: boolean;
  isSearchMatch?: boolean;
  isDimmed?: boolean;
  layoutDirection?: 'TB' | 'LR';
}

export interface RouteNodeData extends BaseNodeData {
  nodeType: 'route';
  route: UIRoute;
}

export interface PageNodeData extends BaseNodeData {
  nodeType: 'page';
  page: UIComponent;
  routePath?: string;
  childrenCount: number;
}

export interface ComponentNodeData extends BaseNodeData {
  nodeType: 'component';
  component: UIComponent;
  isExpanded: boolean;
  actionsCount: number;
  hooksCount: number;
}

export interface ActionNodeData extends BaseNodeData {
  nodeType: 'action';
  action: ComponentAction;
}

export interface HookNodeData extends BaseNodeData {
  nodeType: 'hook';
  hook: ComponentHook;
}

export interface StoreNodeData extends BaseNodeData {
  nodeType: 'store';
  store: ComponentStoreAccess;
}

export interface ApiNodeData extends BaseNodeData {
  nodeType: 'api';
  apiCall: ApiCall;
}

export type CustomNodeData =
  | RouteNodeData
  | PageNodeData
  | ComponentNodeData
  | ActionNodeData
  | HookNodeData
  | StoreNodeData
  | ApiNodeData;

export type FlowUINode = Node<CustomNodeData, UINodeType>;

export type FlowUIEdgeRelation =
  | 'routes_to'
  | 'renders'
  | 'triggers'
  | 'uses_hook'
  | 'accesses_store'
  | 'calls_api';

export interface FlowUIEdgeData extends Record<string, unknown> {
  relation: FlowUIEdgeRelation;
  label?: string;
  isDimmed?: boolean;
}

export type FlowUIEdge = Edge<FlowUIEdgeData>;

export interface GraphFilterState {
  searchQuery: string;
  showRoutes: boolean;
  showPages: boolean;
  showComponents: boolean;
  showActions: boolean;
  showHooks: boolean;
  showStores: boolean;
  showApis: boolean;
}
