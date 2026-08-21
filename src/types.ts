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
  type: string;
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
  // UI Node reference (Phase 3)
  uiNode?: UINode;
  // GitHub PR Diff status
  diffStatus?: 'added' | 'modified' | 'removed';
  diffAdditions?: number;
  diffDeletions?: number;
}

export interface Link extends d3.SimulationLinkDatum<FlatNode> {
  source: string | FlatNode;
  target: string | FlatNode;
  kind?: 'structural' | SemanticEdgeType | 'dependency';
  // Edge styling for dependency visualization
  edgeStyle?: 'solid' | 'dashed';
  dependencyType?: DependencyStatus;
}

export type SemanticEdgeType = 'import' | 'call';

export interface SemanticLink extends Link {
  kind: SemanticEdgeType;
}

export type GraphViewMode = 'structural' | 'semantic' | 'ui';

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
  DETECTING_FRAMEWORK = 'DETECTING_FRAMEWORK',
  ERROR = 'ERROR'
}

// ============================================
// Framework Detection Types (Phase 1)
// ============================================

export type FrameworkName = 'react' | 'vue' | 'angular' | 'svelte' | 'nextjs' | 'nuxt' | 'other';

export interface DetectedFramework {
  name: FrameworkName;
  confidence: number;
  entryPoint: string;
  routerType?: string;
  stateManagement?: string;
}

// ============================================
// UI Hierarchy Types (Phase 2)
// ============================================

export interface UINode {
  id: string;
  name: string;
  label: string;
  type: 'app' | 'page' | 'layout' | 'section' | 'component' | 'button' | 'input' | 'form' | 'modal' | 'list';
  children: UINode[];
  sourceFile: string;
  lineRange?: [number, number];
  props?: Record<string, string>;
}

export interface UIHierarchyResponse {
  root: UINode;
  totalNodes: number;
  framework: FrameworkName;
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
  timestamp: number;
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

// ============================================
// AI Context Balloon & Thread System Types
// ============================================

/**
 * Modos de ação disponíveis no balão de IA contextual.
 * Cada modo ajusta o tom e foco da conversa com a IA.
 */
export type AIActionMode = 'explore' | 'create' | 'alter' | 'fix' | 'connect' | 'ask';

/**
 * Labels em português para os modos de ação.
 */
export const AI_ACTION_METADATA: Record<
  AIActionMode,
  {
    label: string;
    description: string;
  }
> = {
  explore: {
    label: 'Explorar',
    description: 'O que esse elemento faz?',
  },
  create: {
    label: 'Criar',
    description: 'Criar algo novo aqui',
  },
  alter: {
    label: 'Alterar',
    description: 'Modificar funcionalidade',
  },
  fix: {
    label: 'Corrigir',
    description: 'Resolver problema/bug',
  },
  connect: {
    label: 'Conectar',
    description: 'Ligar a outro elemento',
  },
  ask: {
    label: 'Perguntar',
    description: 'Pergunta livre',
  },
};

export const AI_ACTION_LABELS: Record<AIActionMode, string> = Object.fromEntries(
  Object.entries(AI_ACTION_METADATA).map(([mode, metadata]) => [
    mode,
    metadata.label,
  ])
) as Record<AIActionMode, string>;

/**
 * Mensagem individual em uma conversa com a IA.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: AIActionMode;
  timestamp: number;
  /** Tokens estimados desta mensagem */
  tokenEstimate?: number;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

/**
 * Referência ao elemento base de uma Thread.
 * Pode ser um arquivo, componente, função, etc.
 */
export interface ThreadBaseElement {
  nodeId: string;
  name: string;
  path: string;
  type: string;
  /** Snippet de código relevante, se disponível */
  codeSnippet?: string;
}

/**
 * Sugestão gerada pela IA durante a conversa.
 * Pode ser um arquivo a criar, API a implementar, snippet de código, etc.
 */
export interface ThreadSuggestion {
  id: string;
  type: 'file' | 'api' | 'snippet' | 'migration' | 'table' | 'service';
  title: string;
  description: string;
  /** Conteúdo/código da sugestão */
  content?: string;
  /** Caminho do arquivo (para sugestões de arquivo) */
  path?: string;
  /** Linhas afetadas [início, fim] */
  lines?: [number, number];
  /** Se foi incluída no prompt final */
  included: boolean;
}

/**
 * Thread de trabalho: uma conversa focada sobre um elemento específico.
 * Representa uma sessão de interação com a IA.
 */
export interface Thread {
  id: string;
  title: string;
  /** Elementos base sobre os quais a conversa se baseia */
  baseElements: ThreadBaseElement[];
  /** Modos usados durante a conversa (pode mudar sem reset) */
  modesUsed: AIActionMode[];
  /** Modo atual ativo */
  currentMode: AIActionMode;
  /** Histórico de mensagens */
  conversation: ChatMessage[];
  /** Sugestões geradas pela IA */
  suggestions: ThreadSuggestion[];
  /** Perguntas de follow-up sugeridas */
  followUpQuestions: string[];
  /** Contagem total de tokens estimada */
  tokenCount: number;
  /** Status da thread */
  status: 'active' | 'paused' | 'completed';
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
}

/**
 * Thread salva na biblioteca para reuso.
 * Inclui metadados adicionais para organização.
 */
export interface SavedThread extends Thread {
  /** Nota do usuário sobre porque salvou */
  userNote: string;
  /** Tags para organização */
  tags: string[];
  /** Data de salvamento */
  savedAt: number;
}

/**
 * Estado do Basket (cesta de threads).
 * Armazena threads ativas e monitora uso de tokens.
 */
export interface BasketState {
  /** Threads ativas no basket */
  threads: Thread[];
  /** ID da thread ativa (em foco) */
  activeThreadId: string | null;
  /** Total de tokens consumidos */
  totalTokens: number;
  /** Limite máximo de tokens (para contexto da IA) */
  maxTokens: number;
  /** Percentual para warning (amarelo) */
  warningThreshold: number;
  /** Percentual para danger (vermelho) */
  dangerThreshold: number;
}

/**
 * Configuração para o Prompt Agent.
 * Define preferências para geração do prompt final.
 */
export interface PromptAgentConfig {
  /** Stack preferida para sugestões de backend */
  preferredStack: 'supabase' | 'firebase' | 'express' | 'nextjs' | 'auto';
  /** Incluir contexto do projeto */
  includeProjectContext: boolean;
  /** Incluir convenções de código */
  includeConventions: boolean;
  /** Nível de detalhe do prompt */
  detailLevel: 'minimal' | 'standard' | 'detailed';
  /** Formato de saída */
  outputFormat: 'markdown' | 'structured' | 'cursor' | 'windsurf';
}

/**
 * Input para o Prompt Agent.
 */
export interface PromptAgentInput {
  task: string;
  context?: string;
  files?: string[];
}

/**
 * Resultado da geração de prompt pelo Prompt Agent.
 */
export interface GeneratedPrompt {
  /** Prompt gerado */
  content: string;
  /** Tokens do prompt */
  tokenCount: number;
  /** Técnicas de prompt engineering aplicadas */
  techniquesApplied: string[];
  /** Seções incluídas */
  sections: {
    context: string;
    tasks: string;
    instructions: string;
    validation: string;
  };
  /** Timestamp de geração */
  generatedAt: number;
}

// ==============================================================================
// GitHub Integration Types
// ==============================================================================

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
}

export interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: 'open' | 'closed';
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubPullRequestDetail extends GitHubPullRequest {
  files: GitHubPullRequestFile[];
  totalAdditions: number;
  totalDeletions: number;
}

export interface GitHubCommitItem {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author?: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface GitHubUserProfile {
  login: string;
  id: number;
  avatar_url: string;
  name?: string | null;
  html_url: string;
  public_repos?: number;
  total_private_repos?: number;
  owned_private_repos?: number;
}

export interface GitHubRepoItem {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
    avatar_url?: string;
  };
  description?: string | null;
  updated_at: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  stargazers_count?: number;
  fork?: boolean;
}

export interface CreatePrPayload {
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody?: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

// ==============================================================================
// Visual Context Inspector & Execution Trail Types
// ==============================================================================

export type TrailStage = 'ui' | 'state' | 'network' | 'type' | 'util';
export type TrailNodeType = 'component' | 'hook' | 'store' | 'api' | 'type' | 'schema' | 'util';

export interface TrailNode {
  id: string;
  name: string;
  path: string;
  stage: TrailStage;
  type: TrailNodeType;
  description?: string;
  codeSnippet?: string;
  lineRange?: [number, number];
  metadata?: {
    hookName?: string;
    actionName?: string;
    endpoint?: string;
    httpMethod?: string;
    typeName?: string;
    props?: string[];
  };
  includedInContext?: boolean;
}

export interface TrailLink {
  source: string;
  target: string;
  label?: string; // 'dispara' | 'invoca hook' | 'chama API' | 'tipado com' | 'importa'
  kind: 'call' | 'state' | 'api' | 'type' | 'import';
}

export interface ComponentTrail {
  rootNodeId: string;
  rootName: string;
  rootPath: string;
  nodes: TrailNode[];
  links: TrailLink[];
  summary: string;
  estimatedTokens: number;
}

export type VisualSurfaceMode = 'hierarchy' | 'preview';

export interface RoutePageInfo {
  id: string;
  name: string;
  route: string;
  path: string;
  type: 'page' | 'layout' | 'component';
  childrenCount: number;
  components: Array<{
    id: string;
    name: string;
    path: string;
    type: 'button' | 'form' | 'modal' | 'card' | 'input' | 'component';
    description?: string;
  }>;
}



