export interface FileSystemNode {
  id: string;
  name: string;
  type: 'directory' | 'file';
  path: string;
  content?: string;
  children?: FileSystemNode[];
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

export interface FlatNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'directory' | 'file' | 'function' | 'class' | 'variable' | 'api_endpoint';
  path: string;
  group: number;
  relevant?: boolean;
  data?: FileSystemNode | CodeNode; // Reference to original data
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

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING_FILES = 'LOADING_FILES',
  ANALYZING_QUERY = 'ANALYZING_QUERY',
  ERROR = 'ERROR'
}
