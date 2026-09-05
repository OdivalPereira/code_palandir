export interface UIWireframeElement {
  id: string;
  type: 'button' | 'input' | 'form' | 'card' | 'table' | 'heading' | 'text' | 'image' | 'modal' | 'list' | 'badge';
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
}
