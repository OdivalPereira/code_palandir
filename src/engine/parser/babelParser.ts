import { parse, type ParserPlugin } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { UIComponent, ComponentAction, ComponentHook, ComponentStoreAccess, ApiCall, UIWireframeElement } from '@/types/analysis';

// Handle ES module default export vs CommonJS
// @ts-expect-error handle module resolution interop
const traverse = (traverseModule.default || traverseModule) as typeof traverseModule;

const PARSER_PLUGINS: ParserPlugin[] = [
  'jsx',
  'typescript',
];

export interface BabelParsedComponentResult {
  components: UIComponent[];
  actions: ComponentAction[];
  hooks: ComponentHook[];
  stores: ComponentStoreAccess[];
  apiCalls: ApiCall[];
}

export function parseSourceWithBabel(
  content: string,
  filePath: string
): BabelParsedComponentResult {
  const components: UIComponent[] = [];
  const allActions: ComponentAction[] = [];
  const allHooks: ComponentHook[] = [];
  const allStores: ComponentStoreAccess[] = [];
  const allApiCalls: ApiCall[] = [];

  let ast;
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: PARSER_PLUGINS,
      errorRecovery: true,
    });
  } catch {
    // If syntax error, return empty result
    return {
      components,
      actions: allActions,
      hooks: allHooks,
      stores: allStores,
      apiCalls: allApiCalls,
    };
  }

  // Determine if this file might be a page (e.g. in pages/, views/, routes/, or has "Page" in name)
  const isLikelyPage =
    /pages\/|views\/|routes\/|app\//i.test(filePath) ||
    /page\.(tsx|jsx|js|ts)$/i.test(filePath) ||
    /Page/i.test(filePath.split('/').pop() || '');

  // Track discovered components in this file
  traverse(ast, {
    // 1. Function Declarations (e.g. function LoginForm() { return <form>...</form>; })
    FunctionDeclaration(path) {
      const name = path.node.id?.name;
      if (!name) return;

      // React component convention: Capitalized name
      if (/^[A-Z]/.test(name)) {
        processComponentNode(path, name);
      }
    },

    // 2. Variable Declarations with Arrow or Function Expressions (e.g. const LoginForm = () => <form>...</form>;)
    VariableDeclarator(path) {
      if (path.node.id.type !== 'Identifier') return;
      const name = path.node.id.name;

      if (!/^[A-Z]/.test(name)) return;

      const init = path.node.init;
      if (
        init &&
        (init.type === 'ArrowFunctionExpression' ||
          init.type === 'FunctionExpression' ||
          (init.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            (init.callee.name === 'memo' || init.callee.name === 'forwardRef')))
      ) {
        processComponentNode(path, name);
      }
    },
  });

  // If no capitalized components found but this is a page/view file with a default export, infer component from filename
  if (components.length === 0 && isLikelyPage) {
    const filename = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Page';
    const inferredName = filename.charAt(0).toUpperCase() + filename.slice(1);
    
    // Quick regex fallback for wireframe elements and actions in this file
    const wireframe = extractWireframeWithRegex(content);
    const actions = extractActionsWithRegex(content, inferredName, filePath);
    const hooks = extractHooksWithRegex(content);
    const apis = extractApisWithRegex(content, inferredName, filePath);

    components.push({
      id: `${filePath}#${inferredName}`,
      name: inferredName,
      filePath,
      isPage: true,
      isExported: true,
      childrenNames: extractChildrenNamesWithRegex(content),
      actions,
      hooks,
      stores: [],
      apiCalls: apis,
      props: [],
      wireframe,
      codeSnippet: content.slice(0, 500),
    });

    allActions.push(...actions);
    allHooks.push(...hooks);
    allApiCalls.push(...apis);
  }

  function processComponentNode(path: any, componentName: string) {
    const actions: ComponentAction[] = [];
    const hooks: ComponentHook[] = [];
    const stores: ComponentStoreAccess[] = [];
    const apiCalls: ApiCall[] = [];
    const wireframe: UIWireframeElement[] = [];
    const childrenNamesSet = new Set<string>();

    const start = path.node.loc?.start.line;
    const end = path.node.loc?.end.line;
    const snippet = content.split('\n').slice(Math.max(0, (start || 1) - 1), end || (start || 1) + 20).join('\n');

    // Traverse inside the component's subtree
    path.traverse({
      // Hooks and Stores and APIs
      CallExpression(callPath: any) {
        const callee = callPath.node.callee;

        // Hook detection: e.g. useState, useEffect, useAuth, useCustomHook
        if (callee.type === 'Identifier' && /^use[A-Z]/.test(callee.name)) {
          const hookName = callee.name;
          const isCustom = !['useState', 'useEffect', 'useContext', 'useReducer', 'useCallback', 'useMemo', 'useRef', 'useId'].includes(hookName);

          const hookObj: ComponentHook = {
            id: `${filePath}#${componentName}#${hookName}#${callPath.node.loc?.start.line || 0}`,
            name: hookName,
            isCustom,
          };
          hooks.push(hookObj);
          allHooks.push(hookObj);

          // If hook looks like a store: useAuthStore, useAppStore, etc.
          if (/Store|State/i.test(hookName)) {
            const storeObj: ComponentStoreAccess = {
              id: `${filePath}#${componentName}#${hookName}`,
              storeName: hookName,
              type: 'zustand',
              properties: [],
            };
            stores.push(storeObj);
            allStores.push(storeObj);
          }
        }

        // API Call detection: fetch('/api/...'), axios.get('/api/...'), etc.
        let endpoint = '';
        let method: ApiCall['method'] = 'UNKNOWN';
        let client: ApiCall['client'] = 'fetch';

        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          client = 'fetch';
          method = 'GET';
          const arg0 = callPath.node.arguments[0];
          if (arg0 && arg0.type === 'StringLiteral') endpoint = arg0.value;
          const arg1 = callPath.node.arguments[1];
          if (arg1 && arg1.type === 'ObjectExpression') {
            for (const prop of arg1.properties) {
              if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && prop.key.name === 'method') {
                if (prop.value.type === 'StringLiteral') {
                  method = prop.value.value.toUpperCase() as any;
                }
              }
            }
          }
        } else if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && (callee.object.name === 'axios' || callee.object.name === 'api')) {
          client = 'axios';
          const propName = callee.property.type === 'Identifier' ? callee.property.name.toUpperCase() : 'GET';
          if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(propName)) {
            method = propName as any;
          }
          const arg0 = callPath.node.arguments[0];
          if (arg0 && arg0.type === 'StringLiteral') endpoint = arg0.value;
        }

        if (endpoint) {
          const apiObj: ApiCall = {
            id: `${filePath}#${endpoint}#${callPath.node.loc?.start.line || 0}`,
            endpoint,
            method,
            client,
            callerComponent: componentName,
            filePath,
          };
          apiCalls.push(apiObj);
          allApiCalls.push(apiObj);
        }
      },

      // JSX Element traversal: extract UI Wireframe and child component names
      JSXElement(jsxPath: any) {
        const opening = jsxPath.node.openingElement;
        const nameNode = opening.name;

        if (nameNode.type === 'JSXIdentifier') {
          const tagName = nameNode.name;

          // If uppercase -> Child Component (e.g. <Sidebar />, <Button />, <UserCard />)
          if (/^[A-Z]/.test(tagName) && tagName !== componentName) {
            childrenNamesSet.add(tagName);
          }

          // Wireframe element detection
          if (tagName === 'button' || tagName === 'Button') {
            let label = 'Button';
            let actionName = '';
            for (const attr of opening.attributes) {
              if (attr.type === 'JSXAttribute' && attr.name.name === 'onClick') {
                if (attr.value?.type === 'JSXExpressionContainer' && attr.value.expression.type === 'Identifier') {
                  actionName = attr.value.expression.name;
                }
              }
            }
            wireframe.push({
              id: `wf-btn-${wireframe.length}`,
              type: 'button',
              label,
              actionName,
            });
          } else if (tagName === 'input' || tagName === 'Input') {
            let placeholder = 'Input text...';
            for (const attr of opening.attributes) {
              if (attr.type === 'JSXAttribute' && attr.name.name === 'placeholder' && attr.value?.type === 'StringLiteral') {
                placeholder = attr.value.value;
              }
            }
            wireframe.push({
              id: `wf-input-${wireframe.length}`,
              type: 'input',
              placeholder,
            });
          } else if (tagName === 'form' || tagName === 'Form') {
            wireframe.push({
              id: `wf-form-${wireframe.length}`,
              type: 'form',
              label: 'Form',
            });
          } else if (/^h[1-6]$/.test(tagName)) {
            wireframe.push({
              id: `wf-head-${wireframe.length}`,
              type: 'heading',
              label: tagName.toUpperCase(),
            });
          } else if (tagName === 'table' || tagName === 'Table') {
            wireframe.push({
              id: `wf-tbl-${wireframe.length}`,
              type: 'table',
              label: 'Data Table',
            });
          }
        }
      },

      // Action Handlers: e.g. const handleSubmit = async () => { ... }
      Function(funcPath: any) {
        if (funcPath.parentPath?.isVariableDeclarator()) {
          const id = funcPath.parentPath.node.id;
          if (id.type === 'Identifier' && (/^handle[A-Z]/.test(id.name) || /^on[A-Z]/.test(id.name))) {
            const actionName = id.name;
            const actionStart = funcPath.node.loc?.start.line;
            const actionEnd = funcPath.node.loc?.end.line;
            const actionSnippet = content.split('\n').slice(Math.max(0, (actionStart || 1) - 1), actionEnd || (actionStart || 1) + 15).join('\n');

            const actionObj: ComponentAction = {
              id: `${filePath}#${componentName}#${actionName}`,
              name: actionName,
              trigger: actionName.startsWith('on') ? actionName : `on${actionName.replace(/^handle/, '')}`,
              componentName,
              filePath,
              codeSnippet: actionSnippet,
              apiCalls: [],
              stateUpdates: [],
              lineStart: actionStart,
              lineEnd: actionEnd,
            };
            actions.push(actionObj);
            allActions.push(actionObj);
          }
        }
      },
    });

    const compObj: UIComponent = {
      id: `${filePath}#${componentName}`,
      name: componentName,
      filePath,
      isPage: isLikelyPage,
      isExported: true,
      childrenNames: Array.from(childrenNamesSet),
      actions,
      hooks,
      stores,
      apiCalls,
      props: [],
      wireframe,
      codeSnippet: snippet,
      lineStart: start,
      lineEnd: end,
    };

    components.push(compObj);
  }

  return {
    components,
    actions: allActions,
    hooks: allHooks,
    stores: allStores,
    apiCalls: allApiCalls,
  };
}

// Regex helpers for fast heuristics & fallback
function extractWireframeWithRegex(content: string): UIWireframeElement[] {
  const elements: UIWireframeElement[] = [];
  if (/<button|<Button/i.test(content)) {
    elements.push({ id: 'btn-1', type: 'button', label: 'Action Button' });
  }
  if (/<input|<Input|<textarea/i.test(content)) {
    elements.push({ id: 'inp-1', type: 'input', placeholder: 'Enter value...' });
  }
  if (/<form/i.test(content)) {
    elements.push({ id: 'frm-1', type: 'form', label: 'Form Section' });
  }
  if (/<table|<Table/i.test(content)) {
    elements.push({ id: 'tbl-1', type: 'table', label: 'Data Table' });
  }
  return elements;
}

function extractActionsWithRegex(content: string, componentName: string, filePath: string): ComponentAction[] {
  const actions: ComponentAction[] = [];
  const matches = content.matchAll(/(?:const|function)\s+(handle[A-Za-z0-9_]+|on[A-Za-z0-9_]+)/g);
  for (const m of matches) {
    const name = m[1];
    actions.push({
      id: `${filePath}#${componentName}#${name}`,
      name,
      trigger: name.startsWith('on') ? name : 'onClick',
      componentName,
      filePath,
      codeSnippet: `const ${name} = () => { ... }`,
      apiCalls: [],
      stateUpdates: [],
    });
  }
  return actions;
}

function extractHooksWithRegex(content: string): ComponentHook[] {
  const hooks: ComponentHook[] = [];
  const matches = content.matchAll(/\b(use[A-Z][A-Za-z0-9_]+)\b/g);
  const seen = new Set<string>();
  for (const m of matches) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      hooks.push({
        id: name,
        name,
        isCustom: !['useState', 'useEffect', 'useContext'].includes(name),
      });
    }
  }
  return hooks;
}

function extractApisWithRegex(content: string, componentName: string, filePath: string): ApiCall[] {
  const apis: ApiCall[] = [];
  const fetchMatches = content.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g);
  for (const m of fetchMatches) {
    apis.push({
      id: `${filePath}#${m[1]}`,
      endpoint: m[1],
      method: 'GET',
      client: 'fetch',
      callerComponent: componentName,
      filePath,
    });
  }
  return apis;
}

function extractChildrenNamesWithRegex(content: string): string[] {
  const names = new Set<string>();
  const matches = content.matchAll(/<([A-Z][A-Za-z0-9_]+)(?:\s|\/|>)/g);
  for (const m of matches) {
    names.add(m[1]);
  }
  return Array.from(names);
}
