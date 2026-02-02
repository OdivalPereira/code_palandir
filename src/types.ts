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

export type SelectedNodePayload = {
  id?: string | null;
  name: string;
  path: string;
  type: string;
};

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
  kind?: 'structural' | SemanticEdgeType;
  // Edge styling for dependency visualization
  edgeStyle?: 'solid' | 'dashed';
  dependencyType?: DependencyStatus;
}

export type SemanticEdgeType = 'import' | 'call';

export interface SemanticLink extends Link {
  kind: SemanticEdgeType;
}

export type GraphViewMode = 'structural' | 'semantic';

export interface PromptItem {
  id: string;
  title: string;
  content: string;
  type: 'code' | 'comment' | 'context';
}

export interface ModuleInput {
  id: string;
  name: string;
  files: string[];
  dependencies: string[];
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
  semanticLinks?: Array<{
    source: string;
    target: string;
    kind: SemanticEdgeType;
  }>;
  graphViewMode?: GraphViewMode;
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

export type PresenceCursor = {
  x: number;
  y: number;
};

export type PresenceSelection = {
  selectedNodeId: string | null;
};

export type PresenceProfile = {
  name: string;
  color: string;
};

export type PresenceState = {
  clientId: string;
  profile: PresenceProfile;
  cursor: PresenceCursor | null;
  selection: PresenceSelection;
  sequence: number;
  updatedAt: number;
};

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
  fileContent: string;
  selectedNode: SelectedNodePayload;
  componentCode?: string;
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

export type AiUsageTokens = {
  promptTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type AiAuditEntry = {
  id: string;
  timestamp: string;
  requestType: string;
  model: string;
  provider: string;
  latencyMs: number;
  success: boolean;
  error?: string | null;
  usage?: AiUsageTokens | null;
  costUsd?: number | null;
};

export type AiMetricsSummary = {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  hitRate: number;
  averageLatencyMs: number;
  totalCostUsd: number;
  averageCostUsd: number;
  lastUpdated: string;
};

export type AiMetricsResponse = {
  summary: AiMetricsSummary;
  recent: AiAuditEntry[];
};
