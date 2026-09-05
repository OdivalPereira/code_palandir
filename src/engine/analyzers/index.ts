import type { ProjectFile } from '@/types/project';
import type { ProjectAnalysis, UIComponent, ComponentAction, ComponentHook, ComponentStoreAccess, ApiCall } from '@/types/analysis';
import { detectFramework } from './frameworkDetector';
import { ReactAnalyzer } from './reactAnalyzer';
import { VueAnalyzer } from './vueAnalyzer';
import { AngularAnalyzer } from './angularAnalyzer';
import { detectRoutes } from './routeDetector';

export function analyzeProject(files: ProjectFile[]): ProjectAnalysis {
  const startTime = performance.now();
  const framework = detectFramework(files);

  const reactAnalyzer = new ReactAnalyzer();
  const vueAnalyzer = new VueAnalyzer();
  const angularAnalyzer = new AngularAnalyzer();

  const allComponents: UIComponent[] = [];
  const allActions: ComponentAction[] = [];
  const allHooks: ComponentHook[] = [];
  const allStores: ComponentStoreAccess[] = [];
  const allApiCalls: ApiCall[] = [];

  for (const file of files) {
    let comps: UIComponent[] = [];
    if (reactAnalyzer.canHandle(file)) {
      comps = reactAnalyzer.analyzeComponents(file);
    } else if (vueAnalyzer.canHandle(file)) {
      comps = vueAnalyzer.analyzeComponents(file);
    } else if (angularAnalyzer.canHandle(file)) {
      comps = angularAnalyzer.analyzeComponents(file);
    }

    for (const comp of comps) {
      allComponents.push(comp);
      allActions.push(...comp.actions);
      allHooks.push(...comp.hooks);
      allStores.push(...comp.stores);
      allApiCalls.push(...comp.apiCalls);
    }
  }

  // Detect routes
  const routes = detectRoutes(files, allComponents);

  // Mark components that correspond to routes as pages
  for (const route of routes) {
    const matchedComp = allComponents.find(c => c.name === route.pageComponentName);
    if (matchedComp) {
      matchedComp.isPage = true;
    }
  }

  const pages = allComponents.filter(c => c.isPage);
  const regularComponents = allComponents.filter(c => !c.isPage);

  const duration = performance.now() - startTime;

  return {
    framework,
    routes,
    pages,
    components: regularComponents,
    actions: allActions,
    hooks: allHooks,
    stores: allStores,
    apiCalls: allApiCalls,
    analysisDurationMs: Math.round(duration),
  };
}
