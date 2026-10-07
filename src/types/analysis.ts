export interface UIWireframeElement {
  id: string;
  type: 'button' | 'input' | 'form' | 'card' | 'table' | 'heading' | 'text' | 'image' | 'modal' | 'list' | 'badge' | 'tabs';
  label?: string;
  placeholder?: string;
  actionName?: string;
}

export interface ComponentAction {
  id: string;
  name: string;                   // e.g. "handleSubmit", "handleDelete"
  trigger: string;                // e.g. "onClick", "onSubmit", "@click", "(click)"
  componentName: string;
  filePath: string;
  codeSnippet: string;
  apiCalls: string[];             // URLs or endpoints called inside this handler
  stateUpdates: string[];          // State setters or dispatch calls
  lineStart?: number;
  lineEnd?: number;
}

export interface ComponentHook {
  id: string;
  name: string;                   // e.g. "useState", "useAuth", "useQuery"
  isCustom: boolean;
  importedFrom?: string;
  args?: string[];
}

export interface ComponentStoreAccess {
  id: string;
  storeName: string;              // e.g. "useAuthStore", "userState"
  type: 'zustand' | 'redux' | 'pinia' | 'vuex' | 'context' | 'angular-service';
  properties: string[];           // e.g. ["user", "login", "logout"]
}

export interface ApiCall {
  id: string;
  endpoint: string;               // e.g. "/api/auth/login" or relative URL
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UNKNOWN';
  client: 'fetch' | 'axios' | 'useQuery' | 'useSWR' | 'httpClient';
  callerComponent: string;
  callerAction?: string;
  filePath: string;
  codeSnippet?: string;
}

export interface UIComponent {
  id: string;
  name: string;                   // e.g. "LoginForm"
  filePath: string;
  isPage: boolean;
  isExported: boolean;
  childrenNames: string[];        // Components rendered inside this component's JSX/template
  actions: ComponentAction[];     // Interactive handlers (buttons, submits)
  hooks: ComponentHook[];         // React/Vue hooks used
  stores: ComponentStoreAccess[]; // Stores accessed
  apiCalls: ApiCall[];            // Network requests
  props: string[];                // Declared props
  wireframe: UIWireframeElement[];// Visual preview elements extracted from template/JSX
  codeSnippet: string;            // Primary implementation snippet
  lineStart?: number;
  lineEnd?: number;
}

export interface UIRoute {
  id: string;
  path: string;                   // e.g. "/login", "/dashboard", "/users/:id"
  pageComponentName: string;      // e.g. "LoginPage"
  filePath: string;
  parentRouteId?: string;
}

export interface ComponentCouplingMetrics {
  componentName: string;
  filePath: string;
  isPage: boolean;
  afferentCoupling: number;      // Ca: quantos outros componentes dependem/renderizam este
  efferentCoupling: number;      // Ce: quantos subcomponentes, stores, APIs e hooks este componente consome
  instability: number;           // I = Ce / (Ca + Ce), de 0 (máxima estabilidade) a 1 (máxima instabilidade)
  isGodComponent: boolean;       // Componente hipertrofiado com excesso de responsabilidades
  hasLayerViolation: boolean;    // Componente de UI que efetua chamadas diretas de API sem camada de serviço/store
  complexityScore: number;       // Score ponderado de complexidade arquitetural
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];             // Diagnósticos textuais específicos
}

export interface ArchitecturalHealthReport {
  totalComponents: number;
  averageInstability: number;
  godComponentsCount: number;
  layerViolationsCount: number;
  overallHealthScore: number;     // De 0 (risco crítico) a 100 (arquitetura exemplar)
  componentsMetrics: ComponentCouplingMetrics[];
  highestRiskComponents: ComponentCouplingMetrics[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

export interface ProjectAnalysis {
  framework: import('./project').SupportedFramework;
  routes: UIRoute[];
  pages: UIComponent[];
  components: UIComponent[];
  actions: ComponentAction[];
  hooks: ComponentHook[];
  stores: ComponentStoreAccess[];
  apiCalls: ApiCall[];
  analysisDurationMs: number;
  architecturalHealth?: ArchitecturalHealthReport;
}
