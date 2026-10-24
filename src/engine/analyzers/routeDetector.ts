import type { ProjectFile, SupportedFramework } from '@/types/project';
import type { UIRoute, UIComponent } from '@/types/analysis';
import { detectNextAppRoutes } from './nextAppRouterDetector';

const PAGES_ROUTER_FILE = /(?:^|\/)pages\/(.+)\.(?:tsx|jsx|js|ts)$/i;

// JSX wrappers around the routed screen: <Suspense fallback={...}><Page /></Suspense>
const ROUTE_WRAPPERS = new Set(['Suspense', 'React.Suspense', 'Fragment', 'React.Fragment', 'StrictMode', 'React.StrictMode']);

/** Text inside the braces that open at `open` (content[open] === '{'), or null if unbalanced. */
function balancedBraces(content: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * The screen a route element renders, looking through Suspense/Fragment wrappers and ignoring
 * whatever sits in `fallback={...}`. Returns the first known component, or null.
 */
function screenInElement(expression: string, isKnown: (name: string) => boolean): string | null {
  let cleaned = expression;
  for (let at = cleaned.indexOf('fallback={'); at >= 0; at = cleaned.indexOf('fallback={')) {
    const inner = balancedBraces(cleaned, at + 'fallback='.length);
    if (inner === null) break;
    cleaned = cleaned.slice(0, at) + cleaned.slice(at + 'fallback={'.length + inner.length + 1);
  }
  for (const m of cleaned.matchAll(/<([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?)/g)) {
    if (!ROUTE_WRAPPERS.has(m[1]) && isKnown(m[1])) return m[1];
  }
  return null;
}

/**
 * @param framework when known, the file-based Pages Router convention only applies to Next.js;
 *   a React SPA with a `src/pages/` folder declares its routes in the router instead.
 */
export function detectRoutes(
  files: ProjectFile[],
  components: UIComponent[],
  framework?: SupportedFramework
): UIRoute[] {
  const usePagesRouter = framework === undefined || framework === 'nextjs';
  const routes: UIRoute[] = [];
  const componentMap = new Map<string, UIComponent>();
  for (const c of components) {
    componentMap.set(c.name, c);
  }

  // 1. Next.js App Router (Suporte completo a route groups, dynamic params, catch-all)
  const { routes: appRouterRoutes } = detectNextAppRoutes(files, components);
  routes.push(...appRouterRoutes);

  // 1.1 Next.js Pages Router
  for (const file of usePagesRouter ? files : []) {
    const p = file.path;

    // Pages Router: e.g. pages/about.tsx, pages/users/[id].tsx
    if (PAGES_ROUTER_FILE.test(p) && !p.includes('_app') && !p.includes('_document') && !p.includes('/api/')) {
      const match = p.match(PAGES_ROUTER_FILE);
      if (match) {
        let routePath = '/' + match[1].replace(/index$/i, '').replace(/\[([^\]]+)\]/g, ':$1');
        if (routePath.length > 1 && routePath.endsWith('/')) {
          routePath = routePath.slice(0, -1);
        }
        if (!routePath) routePath = '/';

        const pageComp = components.find(c => c.filePath === file.path) || {
          name: inferComponentNameFromFile(p),
        };

        routes.push({
          id: `route-${routePath}`,
          path: routePath,
          pageComponentName: pageComp.name,
          filePath: file.path,
        });
        continue;
      }
    }
  }

  // 2. React Router JSX syntax: <Route path="/users" element={<UsersPage />} />
  for (const file of files) {
    // Skip mock/demo files, test files, and analyzer engines when detecting project routes
    if (
      file.path.includes('/analyzers/') ||
      file.path.includes('demoProject') ||
      file.path.includes('__tests__') ||
      file.path.includes('.test.') ||
      file.path.includes('.spec.')
    ) {
      continue;
    }

    // Strip comments to prevent matching example code or docs in comments
    const content = file.content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    if (content.includes('<Route') || content.includes('createBrowserRouter') || content.includes('createRoutesFromElements')) {
      const isKnown = (name: string) => componentMap.has(name);
      const routeMatches = content.matchAll(/<Route[^>]*path=["']([^"']+)["'][^>]*(?:element=\{<([A-Za-z0-9_]+)|component=\{([A-Za-z0-9_]+))/g);
      for (const m of routeMatches) {
        const routePath = m[1];
        let compName = m[2] || m[3] || 'PageComponent';
        if (m[2] && !isKnown(compName) && m.index !== undefined) {
          const open = content.indexOf('element={', m.index) + 'element='.length;
          const expression = balancedBraces(content, open);
          compName = (expression && screenInElement(expression, isKnown)) || compName;
        }
        // Only accept if component exists in the analyzed codebase or is a common router pattern
        if (componentMap.has(compName) || components.some((c) => c.name === compName)) {
          routes.push({
            id: `route-${routePath}`,
            path: routePath,
            pageComponentName: compName,
            filePath: file.path,
          });
        }
      }

      // createBrowserRouter([{ path: '/login', element: <LoginPage /> }])
      const objectMatches = content.matchAll(/path:\s*['"]([^'"]+)['"]\s*,\s*(?:element:\s*<([A-Za-z0-9_]+)|Component:\s*([A-Za-z0-9_]+))/g);
      for (const m of objectMatches) {
        const routePath = m[1];
        const compName = m[2] || m[3] || 'PageComponent';
        if (componentMap.has(compName) || components.some((c) => c.name === compName)) {
          routes.push({
            id: `route-${routePath}`,
            path: routePath,
            pageComponentName: compName,
            filePath: file.path,
          });
        }
      }
    }

    // 3. Vue Router: { path: '/about', component: AboutView }
    if (content.includes('createRouter') || content.includes('vue-router') || file.path.includes('router')) {
      const vueMatches = content.matchAll(/path:\s*['"]([^'"]+)['"]\s*,\s*(?:name:\s*['"][^'"]+['"]\s*,\s*)?component:\s*([A-Za-z0-9_]+)/g);
      for (const m of vueMatches) {
        const routePath = m[1];
        const compName = m[2];
        if (componentMap.has(compName) || components.some((c) => c.name === compName)) {
          routes.push({
            id: `route-${routePath}`,
            path: routePath,
            pageComponentName: compName,
            filePath: file.path,
          });
        }
      }
    }
  }

  // Deduplicate routes by path
  const seenPaths = new Set<string>();
  const uniqueRoutes: UIRoute[] = [];
  for (const r of routes) {
    if (!seenPaths.has(r.path)) {
      seenPaths.add(r.path);
      uniqueRoutes.push(r);
    }
  }

  // Fallback: If no routes were detected, create a synthetic Root Route linking to the main page/app component
  if (uniqueRoutes.length === 0) {
    const mainPage = components.find(c => c.isPage) || components.find(c => c.name === 'App' || c.name === 'Index') || components[0];
    if (mainPage) {
      uniqueRoutes.push({
        id: 'route-root',
        path: '/',
        pageComponentName: mainPage.name,
        filePath: mainPage.filePath,
      });
    }
  }

  return uniqueRoutes;
}

function inferComponentNameFromFile(path: string): string {
  const parts = path.split('/');
  const filename = parts.pop()?.replace(/\.[^.]+$/, '') || 'Page';
  if (filename === 'page' || filename === 'index') {
    const parentDir = parts.pop() || 'Home';
    return parentDir.charAt(0).toUpperCase() + parentDir.slice(1) + 'Page';
  }
  return filename.charAt(0).toUpperCase() + filename.slice(1);
}
