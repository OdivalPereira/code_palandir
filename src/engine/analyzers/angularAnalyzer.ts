import type { ProjectFile } from '@/types/project';
import type { UIComponent, ComponentAction, ComponentStoreAccess, ApiCall, UIWireframeElement } from '@/types/analysis';
import type { FrameworkAnalyzer } from './types';

export class AngularAnalyzer implements FrameworkAnalyzer {
  canHandle(file: ProjectFile): boolean {
    const p = file.path.toLowerCase();
    return p.endsWith('.component.ts') || (p.endsWith('.ts') && file.content.includes('@Component'));
  }

  analyzeComponents(file: ProjectFile): UIComponent[] {
    const content = file.content;
    const classMatch = content.match(/export\s+class\s+([A-Za-z0-9_]+Component)/);
    if (!classMatch) return [];

    const componentName = classMatch[1];
    const isPage =
      /pages\/|views\/|routes\//i.test(file.path) ||
      /Page/i.test(componentName);

    // Actions: public methods in class
    const actions: ComponentAction[] = [];
    const methodMatches = content.matchAll(/(?:public\s+|async\s+)?([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^;{]+)?\s*\{/g);
    for (const m of methodMatches) {
      const name = m[1];
      if (!['ngOnInit', 'ngOnDestroy', 'constructor', 'ngAfterViewInit'].includes(name)) {
        actions.push({
          id: `${file.path}#${componentName}#${name}`,
          name,
          trigger: `(click)="${name}()"`,
          componentName,
          filePath: file.path,
          codeSnippet: `${name}() { ... }`,
          apiCalls: [],
          stateUpdates: [],
        });
      }
    }

    // Injected Services
    const stores: ComponentStoreAccess[] = [];
    const apiCalls: ApiCall[] = [];
    const serviceMatches = content.matchAll(/(?:private|public|protected)\s+([a-zA-Z0-9_]+)\s*:\s*([A-Za-z0-9_]+Service)/g);
    for (const sm of serviceMatches) {
      const serviceName = sm[2];
      stores.push({
        id: `${file.path}#${serviceName}`,
        storeName: serviceName,
        type: 'angular-service',
        properties: [],
      });
    }

    // Check for HttpClient usage
    if (content.includes('HttpClient') || content.includes('http.')) {
      apiCalls.push({
        id: `${file.path}#http`,
        endpoint: '/api (HttpClient)',
        method: 'UNKNOWN',
        client: 'httpClient',
        callerComponent: componentName,
        filePath: file.path,
      });
    }

    const wireframe: UIWireframeElement[] = [
      { id: 'btn-1', type: 'button', label: 'Angular Action' },
      { id: 'inp-1', type: 'input', placeholder: 'Form control' },
    ];

    const component: UIComponent = {
      id: `${file.path}#${componentName}`,
      name: componentName,
      filePath: file.path,
      isPage,
      isExported: true,
      childrenNames: [],
      actions,
      hooks: [],
      stores,
      apiCalls,
      props: [],
      wireframe,
      codeSnippet: content.slice(0, 500),
    };

    return [component];
  }
}
