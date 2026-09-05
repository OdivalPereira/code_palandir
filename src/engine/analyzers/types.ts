import type { ProjectFile } from '@/types/project';
import type { UIComponent, UIRoute, ApiCall, ComponentAction, ComponentHook, ComponentStoreAccess } from '@/types/analysis';

export interface FrameworkAnalyzer {
  canHandle(file: ProjectFile): boolean;
  analyzeComponents(file: ProjectFile): UIComponent[];
  analyzeRoutes?(files: ProjectFile[]): UIRoute[];
}

export interface ParseResult {
  components: UIComponent[];
  routes: UIRoute[];
  actions: ComponentAction[];
  hooks: ComponentHook[];
  stores: ComponentStoreAccess[];
  apiCalls: ApiCall[];
}
