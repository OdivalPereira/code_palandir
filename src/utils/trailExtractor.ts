import { ComponentTrail, TrailLink, TrailNode, RoutePageInfo } from '../types';
import { resolveImportTarget } from '../dependencyParser';

interface TrailExtractorOptions {
  targetPath: string;
  allFilePaths: string[];
  fileMap: Map<string, string>;
  projectFileContents?: Map<string, string>;
}

/**
 * Gets file content from either fileMap or projectFileContents cache.
 */
const getFileContent = (
  path: string,
  fileMap: Map<string, string>,
  projectFileContents?: Map<string, string>
): string => {
  return fileMap.get(path) || projectFileContents?.get(path) || '';
};

/**
 * Extracts a concise code snippet around a function, hook, or component definition.
 */
const extractSnippet = (content: string, keyword?: string, maxLines = 25): string => {
  if (!content) return '';
  const lines = content.split('\n');
  if (!keyword) {
    return lines.slice(0, maxLines).join('\n');
  }

  const index = lines.findIndex((line) => line.includes(keyword));
  if (index === -1) {
    return lines.slice(0, maxLines).join('\n');
  }

  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, start + maxLines);
  return lines.slice(start, end).join('\n');
};

/**
 * Parses imports in a file to map imported symbols to their target resolved file paths.
 */
const parseImportMappings = (
  sourcePath: string,
  content: string,
  filePathSet: Set<string>
): Map<string, { targetPath: string; importedName: string }> => {
  const symbolMap = new Map<string, { targetPath: string; importedName: string }>();
  if (!content) return symbolMap;

  // import { A, B as C } from './target'
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = namedImportRegex.exec(content)) !== null) {
    const rawSymbols = match[1];
    const specifier = match[2];
    const targetPath = resolveImportTarget(sourcePath, specifier, filePathSet);
    if (targetPath) {
      rawSymbols.split(',').forEach((sym) => {
        const clean = sym.trim();
        if (!clean) return;
        const [orig, alias] = clean.split(/\s+as\s+/);
        const importedName = orig.trim();
        const localName = alias ? alias.trim() : importedName;
        symbolMap.set(localName, { targetPath, importedName });
      });
    }
  }

  // import DefaultName from './target'
  const defaultImportRegex = /import\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]+)['"]/g;
  while ((match = defaultImportRegex.exec(content)) !== null) {
    const localName = match[1];
    const specifier = match[2];
    if (localName !== 'type' && localName !== '{') {
      const targetPath = resolveImportTarget(sourcePath, specifier, filePathSet);
      if (targetPath) {
        symbolMap.set(localName, { targetPath, importedName: 'default' });
      }
    }
  }

  // import * as Name from './target'
  const namespaceImportRegex = /import\s*\*\s*as\s+([A-Za-z0-9_$]+)\s+from\s*['"]([^'"]+)['"]/g;
  while ((match = namespaceImportRegex.exec(content)) !== null) {
    const localName = match[1];
    const specifier = match[2];
    const targetPath = resolveImportTarget(sourcePath, specifier, filePathSet);
    if (targetPath) {
      symbolMap.set(localName, { targetPath, importedName: '*' });
    }
  }

  return symbolMap;
};

/**
 * Extracts all hook calls (e.g. useCartStore, useState, useQuery, useMemo, etc.) from component content.
 */
const extractHooksInContent = (content: string): string[] => {
  if (!content) return [];
  const hookRegex = /\b(use[A-Z0-9_$][a-zA-Z0-9_$]*)\b/g;
  const matches = new Set<string>();
  let match;
  while ((match = hookRegex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
};

/**
 * Extracts API / Network call patterns (fetch, axios, apiClient.*, post, get, mutation).
 */
const extractApiPatternsInContent = (content: string): Array<{ name: string; endpoint?: string; method?: string }> => {
  if (!content) return [];
  const results: Array<{ name: string; endpoint?: string; method?: string }> = [];

  // Match fetch('...', ...) or fetch(`...`, ...)
  const fetchRegex = /fetch\(\s*['"`]([^'"`]+)['"`](?:,\s*\{\s*method:\s*['"]([A-Z]+)['"])?/g;
  let match;
  while ((match = fetchRegex.exec(content)) !== null) {
    results.push({
      name: `fetch(${match[1]})`,
      endpoint: match[1],
      method: match[2] || 'GET'
    });
  }

  // Match axios.get/post('...') or apiClient.post('...')
  const clientRegex = /(apiClient|axios|client|api)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = clientRegex.exec(content)) !== null) {
    results.push({
      name: `${match[1]}.${match[2]}('${match[3]}')`,
      endpoint: match[3],
      method: match[2].toUpperCase()
    });
  }

  return results;
};

/**
 * Extracts TypeScript type and interface imports in content.
 */
export const extractTypeNames = (content: string): string[] => {
  if (!content) return [];
  const typeRegex = /\btype\s+([A-Z][a-zA-Z0-9_$]*)|interface\s+([A-Z][a-zA-Z0-9_$]*)/g;
  const types = new Set<string>();
  let match;
  while ((match = typeRegex.exec(content)) !== null) {
    const typeName = match[1] || match[2];
    if (typeName) types.add(typeName);
  }
  return Array.from(types);
};

/**
 * Main function: Extracts the complete execution trail for a given component/file.
 * 
 * Trace flow:
 * [1. UI Component] --> [2. Hooks / Store Action] --> [3. API / Network Endpoint] --> [4. Types & Data Schema]
 */
export const extractComponentTrail = ({
  targetPath,
  allFilePaths,
  fileMap,
  projectFileContents
}: TrailExtractorOptions): ComponentTrail => {
  const filePathSet = new Set(allFilePaths);
  const nodes: TrailNode[] = [];
  const links: TrailLink[] = [];
  const addedNodeIds = new Set<string>();

  const targetFilename = targetPath.split('/').pop() || targetPath;
  const targetBaseName = targetFilename.replace(/\.[^/.]+$/, '');
  const rootContent = getFileContent(targetPath, fileMap, projectFileContents);

  // -------------------------------------------------------------
  // Stage 1: UI Component Entry Node
  // -------------------------------------------------------------
  const rootNodeId = `ui:${targetPath}`;
  const rootNode: TrailNode = {
    id: rootNodeId,
    name: targetFilename,
    path: targetPath,
    stage: 'ui',
    type: targetPath.includes('component') || targetPath.endsWith('.tsx') || targetPath.endsWith('.jsx') ? 'component' : 'util',
    description: `Componente de interface e manipuladores de eventos em ${targetPath}.`,
    codeSnippet: extractSnippet(rootContent, targetBaseName, 25),
    includedInContext: true,
  };

  nodes.push(rootNode);
  addedNodeIds.add(rootNodeId);

  const rootImports = parseImportMappings(targetPath, rootContent, filePathSet);
  const hooksInRoot = extractHooksInContent(rootContent);
  const apiCallsInRoot = extractApiPatternsInContent(rootContent);

  // -------------------------------------------------------------
  // Stage 2: Hooks & State Layer (Store, Context, Custom Hooks)
  // -------------------------------------------------------------
  const visitedStatePaths = new Set<string>();

  hooksInRoot.forEach((hookName) => {
    // Check if imported from a project file
    const importInfo = rootImports.get(hookName);
    const hookPath = importInfo?.targetPath;

    if (hookPath && !visitedStatePaths.has(hookPath)) {
      visitedStatePaths.add(hookPath);
      const hookContent = getFileContent(hookPath, fileMap, projectFileContents);
      const hookFilename = hookPath.split('/').pop() || hookPath;
      const hookNodeId = `state:${hookPath}#${hookName}`;

      const isStore = hookPath.includes('store') || hookContent.includes('create(') || hookContent.includes('createStore');

      const hookNode: TrailNode = {
        id: hookNodeId,
        name: `${hookName} (${hookFilename})`,
        path: hookPath,
        stage: 'state',
        type: isStore ? 'store' : 'hook',
        description: isStore ? `Gerenciamento de estado global via ${hookName}` : `Hook customizado ${hookName}`,
        codeSnippet: extractSnippet(hookContent, hookName, 25),
        metadata: {
          hookName,
          actionName: hookName,
        },
        includedInContext: true,
      };

      if (!addedNodeIds.has(hookNodeId)) {
        nodes.push(hookNode);
        addedNodeIds.add(hookNodeId);
      }

      links.push({
        source: rootNodeId,
        target: hookNodeId,
        label: isStore ? 'consome store' : 'invoca hook',
        kind: 'state',
      });

      // Look for API calls inside this state store / hook
      const apiCallsInHook = extractApiPatternsInContent(hookContent);
      const hookImports = parseImportMappings(hookPath, hookContent, filePathSet);

      // -------------------------------------------------------------
      // Stage 3: API & Services Layer (from State/Hook)
      // -------------------------------------------------------------
      apiCallsInHook.forEach((apiCall) => {
        const apiNodeId = `api:${hookPath}#${apiCall.name}`;
        const apiNode: TrailNode = {
          id: apiNodeId,
          name: apiCall.name,
          path: hookPath,
          stage: 'network',
          type: 'api',
          description: `Chamada de rede ${apiCall.method || 'GET'} para ${apiCall.endpoint || 'servidor'}`,
          codeSnippet: extractSnippet(hookContent, apiCall.endpoint || 'fetch', 15),
          metadata: {
            endpoint: apiCall.endpoint,
            httpMethod: apiCall.method,
          },
          includedInContext: true,
        };

        if (!addedNodeIds.has(apiNodeId)) {
          nodes.push(apiNode);
          addedNodeIds.add(apiNodeId);
        }

        links.push({
          source: hookNodeId,
          target: apiNodeId,
          label: 'dispara chamada API',
          kind: 'api',
        });
      });

      // Follow API Client imports from store/hook
      hookImports.forEach((info, localName) => {
        if (
          info.targetPath.includes('api') ||
          info.targetPath.includes('client') ||
          info.targetPath.includes('service')
        ) {
          const clientContent = getFileContent(info.targetPath, fileMap, projectFileContents);
          const clientFilename = info.targetPath.split('/').pop() || info.targetPath;
          const clientNodeId = `api:${info.targetPath}#${localName}`;

          const clientNode: TrailNode = {
            id: clientNodeId,
            name: `${localName} (${clientFilename})`,
            path: info.targetPath,
            stage: 'network',
            type: 'api',
            description: `Cliente HTTP / Serviço de comunicação em ${info.targetPath}`,
            codeSnippet: extractSnippet(clientContent, localName, 20),
            metadata: {
              actionName: localName,
            },
            includedInContext: true,
          };

          if (!addedNodeIds.has(clientNodeId)) {
            nodes.push(clientNode);
            addedNodeIds.add(clientNodeId);
          }

          links.push({
            source: hookNodeId,
            target: clientNodeId,
            label: 'chama serviço de rede',
            kind: 'api',
          });
        }
      });
    }
  });

  // Direct API calls in Component
  apiCallsInRoot.forEach((apiCall) => {
    const apiNodeId = `api:${targetPath}#${apiCall.name}`;
    const apiNode: TrailNode = {
      id: apiNodeId,
      name: apiCall.name,
      path: targetPath,
      stage: 'network',
      type: 'api',
      description: `Requisição HTTP direta ${apiCall.method || 'GET'} em ${apiCall.endpoint}`,
      codeSnippet: extractSnippet(rootContent, apiCall.endpoint || 'fetch', 15),
      metadata: {
        endpoint: apiCall.endpoint,
        httpMethod: apiCall.method,
      },
      includedInContext: true,
    };

    if (!addedNodeIds.has(apiNodeId)) {
      nodes.push(apiNode);
      addedNodeIds.add(apiNodeId);
    }

    links.push({
      source: rootNodeId,
      target: apiNodeId,
      label: 'chama endpoint',
      kind: 'api',
    });
  });

  // -------------------------------------------------------------
  // Stage 4: Types & Schemas Layer
  // -------------------------------------------------------------
  rootImports.forEach((info, localName) => {
    if (
      info.targetPath.includes('type') ||
      info.targetPath.includes('schema') ||
      info.targetPath.includes('model') ||
      info.targetPath.endsWith('types.ts')
    ) {
      const typeContent = getFileContent(info.targetPath, fileMap, projectFileContents);
      const typeFilename = info.targetPath.split('/').pop() || info.targetPath;
      const typeNodeId = `type:${info.targetPath}#${localName}`;

      const typeNode: TrailNode = {
        id: typeNodeId,
        name: `${localName} (${typeFilename})`,
        path: info.targetPath,
        stage: 'type',
        type: info.targetPath.includes('schema') ? 'schema' : 'type',
        description: `Contrato de tipo e estrutura de dados ${localName}`,
        codeSnippet: extractSnippet(typeContent, localName, 20),
        metadata: {
          typeName: localName,
        },
        includedInContext: true,
      };

      if (!addedNodeIds.has(typeNodeId)) {
        nodes.push(typeNode);
        addedNodeIds.add(typeNodeId);
      }

      links.push({
        source: rootNodeId,
        target: typeNodeId,
        label: 'tipado com',
        kind: 'type',
      });
    }
  });

  // Calculate estimated tokens
  let totalChars = 0;
  nodes.forEach((n) => {
    totalChars += n.name.length + (n.description?.length || 0) + (n.codeSnippet?.length || 0);
  });
  const estimatedTokens = Math.ceil(totalChars / 4);

  const summary = `Trilha de Execução para **${targetFilename}**: ${nodes.length} nós rastreados (UI ➔ Estado ➔ Rede ➔ Tipos).`;

  return {
    rootNodeId,
    rootName: targetFilename,
    rootPath: targetPath,
    nodes,
    links,
    summary,
    estimatedTokens,
  };
};

/**
 * Scans project file paths and returns high-level Pages and Routes for the Visual Surface hierarchy tree.
 */
export const discoverRoutesAndPages = (
  allFilePaths: string[],
  fileMap: Map<string, string>,
  projectFileContents?: Map<string, string>
): RoutePageInfo[] => {
  const routes: RoutePageInfo[] = [];

  // Identify pages, views, and root layouts
  const pageFiles = allFilePaths.filter((path) => {
    return (
      /\/pages\/[^\/]+\.(tsx|jsx|vue|svelte)$/i.test(path) ||
      /\/app\/(?:[^\/]+\/)*page\.(tsx|jsx|js|ts)$/i.test(path) ||
      /\/views\/[^\/]+\.(tsx|jsx|vue)$/i.test(path) ||
      /\/routes\/[^\/]+\.(tsx|jsx)$/i.test(path) ||
      /^(src\/)?(App|index|Main)\.(tsx|jsx)$/i.test(path)
    );
  });

  // Fallback: If no explicit route directory exists, pick components in src/components or top-level components
  const candidateFiles = pageFiles.length > 0
    ? pageFiles
    : allFilePaths.filter((p) => /src\/components\/[^\/]+\.(tsx|jsx)$/i.test(p)).slice(0, 15);

  candidateFiles.forEach((filePath) => {
    const filename = filePath.split('/').pop() || filePath;
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const content = getFileContent(filePath, fileMap, projectFileContents);

    // Compute route path string
    let routePath = '/';
    if (filePath.includes('/pages/')) {
      const seg = filePath.split('/pages/')[1].replace(/\.[^/.]+$/, '');
      routePath = seg === 'index' ? '/' : `/${seg}`;
    } else if (filePath.includes('/app/')) {
      const seg = filePath.split('/app/')[1].replace(/\/page\.[^/.]+$/, '');
      routePath = seg ? `/${seg}` : '/';
    } else if (baseName.toLowerCase() !== 'app' && baseName.toLowerCase() !== 'index') {
      routePath = `/${baseName.toLowerCase()}`;
    }

    // Discover interactive sub-components referenced in this page
    const subComponents: RoutePageInfo['components'] = [];
    const importMap = parseImportMappings(filePath, content, new Set(allFilePaths));

    importMap.forEach((info, localName) => {
      if (
        info.targetPath.includes('component') ||
        info.targetPath.includes('ui') ||
        /^[A-Z]/.test(localName)
      ) {
        let type: RoutePageInfo['components'][0]['type'] = 'component';
        const lower = localName.toLowerCase();
        if (lower.includes('button') || lower.includes('btn')) type = 'button';
        else if (lower.includes('form') || lower.includes('input')) type = 'form';
        else if (lower.includes('modal') || lower.includes('dialog')) type = 'modal';
        else if (lower.includes('card')) type = 'card';

        subComponents.push({
          id: `comp:${info.targetPath}#${localName}`,
          name: localName,
          path: info.targetPath,
          type,
          description: `Componente interativo importado em ${filename}`
        });
      }
    });

    routes.push({
      id: `page:${filePath}`,
      name: baseName,
      route: routePath,
      path: filePath,
      type: filePath.includes('layout') ? 'layout' : 'page',
      childrenCount: subComponents.length,
      components: subComponents,
    });
  });

  return routes;
};
