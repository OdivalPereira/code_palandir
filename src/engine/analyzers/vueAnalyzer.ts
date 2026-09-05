import type { ProjectFile } from '@/types/project';
import type { UIComponent, ComponentAction, ComponentHook, ComponentStoreAccess, ApiCall, UIWireframeElement } from '@/types/analysis';
import type { FrameworkAnalyzer } from './types';

export class VueAnalyzer implements FrameworkAnalyzer {
  canHandle(file: ProjectFile): boolean {
    return file.path.toLowerCase().endsWith('.vue');
  }

  analyzeComponents(file: ProjectFile): UIComponent[] {
    const content = file.content;
    const filename = file.path.split('/').pop()?.replace(/\.vue$/i, '') || 'VueComponent';
    const componentName = filename.charAt(0).toUpperCase() + filename.slice(1);

    const isPage =
      /pages\/|views\/|routes\//i.test(file.path) ||
      /Page/i.test(filename);

    // 1. Extract <template> and <script>
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/i);
    const templateContent = templateMatch ? templateMatch[1] : '';

    const scriptMatch = content.match(/<script(?:\s+setup)?(?:\s+lang=['"][^'"]+['"])?>([\s\S]*?)<\/script>/i);
    const scriptContent = scriptMatch ? scriptMatch[1] : '';

    // 2. Extract child component names from template
    const childrenNamesSet = new Set<string>();
    const tagMatches = templateContent.matchAll(/<([A-Z][A-Za-z0-9_]+)(?:\s|\/|>)/g);
    for (const m of tagMatches) {
      if (m[1] !== componentName) childrenNamesSet.add(m[1]);
    }

    // 3. Extract actions (@click, @submit, v-on:click)
    const actions: ComponentAction[] = [];
    const eventMatches = templateContent.matchAll(/@([a-zA-Z0-9_-]+)="([^"]+)"/g);
    for (const m of eventMatches) {
      const eventName = m[1];
      const handlerExpression = m[2].trim().replace(/\(.*$/, '');
      if (handlerExpression) {
        actions.push({
          id: `${file.path}#${componentName}#${handlerExpression}`,
          name: handlerExpression,
          trigger: `@${eventName}`,
          componentName,
          filePath: file.path,
          codeSnippet: `@${eventName}="${m[2]}"`,
          apiCalls: [],
          stateUpdates: [],
        });
      }
    }

    // 4. Extract hooks/composables and stores from script
    const hooks: ComponentHook[] = [];
    const stores: ComponentStoreAccess[] = [];
    const apiCalls: ApiCall[] = [];

    const hookMatches = scriptContent.matchAll(/\b(use[A-Z][A-Za-z0-9_]+)\b/g);
    const seenHooks = new Set<string>();
    for (const hm of hookMatches) {
      const hName = hm[1];
      if (!seenHooks.has(hName)) {
        seenHooks.add(hName);
        hooks.push({
          id: `${file.path}#${hName}`,
          name: hName,
          isCustom: true,
        });

        if (/Store$/i.test(hName)) {
          stores.push({
            id: `${file.path}#${hName}`,
            storeName: hName,
            type: 'pinia',
            properties: [],
          });
        }
      }
    }

    // 5. Extract API calls (fetch/axios)
    const apiMatches = scriptContent.matchAll(/(?:axios\.(get|post|put|delete)|fetch)\(\s*['"`]([^'"`]+)['"`]/g);
    for (const am of apiMatches) {
      apiCalls.push({
        id: `${file.path}#${am[2]}`,
        endpoint: am[2],
        method: am[1] ? (am[1].toUpperCase() as any) : 'GET',
        client: am[1] ? 'axios' : 'fetch',
        callerComponent: componentName,
        filePath: file.path,
      });
    }

    // 6. Extract wireframe elements
    const wireframe: UIWireframeElement[] = [];
    if (/<button/i.test(templateContent)) {
      wireframe.push({ id: 'btn-1', type: 'button', label: 'Botão Vue' });
    }
    if (/<input|<textarea|<select/i.test(templateContent)) {
      wireframe.push({ id: 'inp-1', type: 'input', placeholder: 'Campo de entrada' });
    }
    if (/<form/i.test(templateContent)) {
      wireframe.push({ id: 'frm-1', type: 'form', label: 'Formulário' });
    }
    if (/<table/i.test(templateContent)) {
      wireframe.push({ id: 'tbl-1', type: 'table', label: 'Tabela de Dados' });
    }
    if (/<(?:h[1-6]|v-card-title)/i.test(templateContent)) {
      wireframe.push({ id: 'head-1', type: 'heading', label: 'Título da Seção' });
    }
    if (/<(?:v-card|el-card|Card|card)/i.test(templateContent)) {
      wireframe.push({ id: 'card-1', type: 'card', label: 'Card de Conteúdo' });
    }
    if (/<(?:v-badge|el-badge|Badge|badge|v-chip|el-tag)/i.test(templateContent)) {
      wireframe.push({ id: 'bdg-1', type: 'badge', label: 'Badge / Tag' });
    }
    if (/<(?:v-dialog|el-dialog|Modal|Dialog)/i.test(templateContent)) {
      wireframe.push({ id: 'mdl-1', type: 'modal', label: 'Modal / Diálogo' });
    }
    if (/<(?:ul|ol|v-list|el-menu)/i.test(templateContent)) {
      wireframe.push({ id: 'lst-1', type: 'list', label: 'Lista de Itens' });
    }
    if (/<(?:v-tabs|el-tabs|Tabs|nav)/i.test(templateContent)) {
      wireframe.push({ id: 'tab-1', type: 'tabs', label: 'Abas de Navegação' });
    }
    if (/<(?:img|v-img|el-image)/i.test(templateContent)) {
      wireframe.push({ id: 'img-1', type: 'image', label: 'Imagem' });
    }

    const component: UIComponent = {
      id: `${file.path}#${componentName}`,
      name: componentName,
      filePath: file.path,
      isPage,
      isExported: true,
      childrenNames: Array.from(childrenNamesSet),
      actions,
      hooks,
      stores,
      apiCalls,
      props: [],
      wireframe,
      codeSnippet: content.slice(0, 500),
    };

    return [component];
  }
}
