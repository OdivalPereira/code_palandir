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
  type: 'directory' | 'file' | 'function' | 'class' | 'variable' | 'api_endpoint' | 'cluster' | 'ghost_table' | 'ghost_endpoint' | 'ghost_service';
  path: string;
  group: number;
  relevant?: boolean;
  data?: FileSystemNode | CodeNode | ClusterData;
  // Mind Map UX properties
  collapsed?: boolean;
  childCount?: number;
  // Ghost node properties for Reverse Dependency Mapping
  isGhost?: boolean;
  dependencyStatus?: DependencyStatus;
  ghostData?: MissingDependency;
}

export interface Link extends d3.SimulationLinkDatum<FlatNode> {
  source: string | FlatNode;
  target: string | FlatNode;
  // Edge styling for dependency visualization
  edgeStyle?: 'solid' | 'dashed';
  dependencyType?: DependencyStatus;
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
  ANALYZING_INTENT = 'ANALYZING_INTENT',
  ERROR = 'ERROR'
}

// ============================================
// Reverse Dependency Mapping Types
// ============================================

// UI Intent Schema - extracted from TSX components
export interface UIIntentSchema {
  component: string;
  fields: UIField[];
  actions: UIAction[];
  dataFlow: DataFlowIntent;
  hooks: string[];
}

export interface UIField {
  name: string;
  type: 'string' | 'number' | 'email' | 'password' | 'date' | 'select' | 'checkbox' | 'textarea';
  validation?: string;
  source?: string;
  required?: boolean;
}

export interface UIAction {
  type: 'submit' | 'click' | 'change';
  handler: string;
  label?: string;
  apiCall?: string;
}

export interface DataFlowIntent {
  direction: 'create' | 'read' | 'update' | 'delete' | 'mixed';
  entityGuess: string;
  confidence: number;
}

// Dependency tracking
export type DependencyStatus = 'existing' | 'partial' | 'missing';

export interface MissingDependency {
  id: string;
  name: string;
  type: 'table' | 'endpoint' | 'service' | 'auth';
  description: string;
  requiredBy: string[];
  suggestedStack?: 'supabase' | 'firebase' | 'custom';
}

// Backend requirements inference
export interface BackendRequirements {
  tables: TableRequirement[];
  endpoints: EndpointRequirement[];
  services: ServiceRequirement[];
}

export interface TableRequirement {
  name: string;
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  constraints?: string[];
}

export interface EndpointRequirement {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description?: string;
  requestBody?: Record<string, string>;
  responseType?: string;
}

export interface ServiceRequirement {
  name: string;
  type: 'auth' | 'email' | 'storage' | 'payment' | 'other';
  description: string;
}

// Prompt Optimizer payload
export interface PromptOptimizerPayload {
  userIntent: string;
  componentCode: string;
  uiIntentSchema: UIIntentSchema;
  projectStructure: ProjectStructure;
  backendRequirements: BackendRequirements;
  preferredStack?: 'supabase' | 'firebase' | 'express' | 'nextjs';
}

export interface ProjectStructure {
  hasBackend: boolean;
  stack: string[];
  existingEndpoints: string[];
}
