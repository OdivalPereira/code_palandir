export interface FileSystemNode {
  id: string;
  name: string;
  type: 'directory' | 'file';
  path: string;
  content?: string;
  children?: FileSystemNode[];
  hasChildren?: boolean;
  descendantCount?: number;
  // Extended structure from analysis
  codeStructure?: CodeNode[];
}

export interface CodeNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'variable' | 'api_endpoint';
  codeSnippet?: string;
  description?: string;
  children?: CodeNode[];
}

export interface ClusterData {
  parentPath: string;
  childCount: number;
}

export interface FlatNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'directory' | 'file' | 'function' | 'class' | 'variable' | 'api_endpoint' | 'cluster';
  path: string;
  group: number;
  relevant?: boolean;
  data?: FileSystemNode | CodeNode | ClusterData; // Reference to original data
}

export interface Link extends d3.SimulationLinkDatum<FlatNode> {
  source: string | FlatNode;
  target: string | FlatNode;
}

export interface PromptItem {
  id: string;
  title: string;
  content: string;
  type: 'code' | 'comment' | 'context';
}

export type ProjectGraphInput = {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    path?: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
};

export type ProjectSummary = {
  summary: string;
  diagram: string;
};

export const SESSION_SCHEMA_VERSION = 1 as const;

export type SessionGraphState = {
  rootNode: FileSystemNode | null;
  highlightedPaths: string[];
  expandedDirectories: string[];
};

export type SessionSelectionState = {
  selectedNodeId: string | null;
};

export type SessionLayoutState = {
  graphHash: string;
  positions: Record<string, { x: number; y: number }>;
};

export type SessionPayload = {
  schemaVersion: number;
  graph: SessionGraphState;
  selection: SessionSelectionState;
  prompts: PromptItem[];
  layout?: SessionLayoutState | null;
};

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING_FILES = 'LOADING_FILES',
  ANALYZING_QUERY = 'ANALYZING_QUERY',
  ERROR = 'ERROR'
}
