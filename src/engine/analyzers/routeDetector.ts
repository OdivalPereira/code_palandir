import type { ProjectFile } from '@/types/project';
import type { UIRoute, UIComponent } from '@/types/analysis';

export function detectRoutes(files: ProjectFile[], components: UIComponent[]): UIRoute[] {
  const routes: UIRoute[] = [];
  const componentMap = new Map<string, UIComponent>();
  for (const c of components) {
    componentMap.set(c.name, c);
  }

  // 1. Next.js file-based routing
  for (const file of files) {
    const p = file.path;

    // App Router: e.g. src/app/login/page.tsx or app/dashboard/page.tsx
    if (/(?:src\/)?app\/(.+)\/page\.(?:tsx|jsx|js|ts)$/i.test(p)) {
      const match = p.match(/(?:src\/)?app\/(.+)\/page\.(?:tsx|jsx|js|ts)$/i);
      if (match) {
        let routePath = '/' + match[1].replace(/\[([^\]]+)\]/g, ':$1');
        // Clean route path
        routePath = routePath.replace(/\/page$/i, '');
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

    // App Router root: app/page.tsx
    if (/(?:src\/)?app\/page\.(?:tsx|jsx|js|ts)$/i.test(p)) {
      const pageComp = components.find(c => c.filePath === file.path) || {
        name: inferComponentNameFromFile(p),
      };
      routes.push({
        id: 'route-root',
        path: '/',
        pageComponentName: pageComp.name,
        filePath: file.path,
      });
      continue;
    }

    // Pages Router: e.g. pages/about.tsx, pages/users/[id].tsx
    if (/(?:src\/)?pages\/(.+)\.(?:tsx|jsx|js|ts)$/i.test(p) && !p.includes('_app') && !p.includes('_document') && !p.includes('/api/')) {
      const match = p.match(/(?:src\/)?pages\/(.+)\.(?:tsx|jsx|js|ts)$/i);
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
    const content = file.content;
    if (content.includes('<Route') || content.includes('createBrowserRouter') || content.includes('createRoutesFromElements')) {
      const routeMatches = content.matchAll(/<Route[^>]*path=["']([^"']+)["'][^>]*(?:element=\{<([A-Za-z0-9_]+)|component=\{([A-Za-z0-9_]+))/g);
      for (const m of routeMatches) {
        const routePath = m[1];
        const compName = m[2] || m[3] || 'PageComponent';
        routes.push({
          id: `route-${routePath}`,
          path: routePath,
          pageComponentName: compName,
          filePath: file.path,
        });
      }

      // createBrowserRouter([{ path: '/login', element: <LoginPage /> }])
      const objectMatches = content.matchAll(/path:\s*['"]([^'"]+)['"]\s*,\s*(?:element:\s*<([A-Za-z0-9_]+)|Component:\s*([A-Za-z0-9_]+))/g);
      for (const m of objectMatches) {
        const routePath = m[1];
        const compName = m[2] || m[3] || 'PageComponent';
        routes.push({
          id: `route-${routePath}`,
          path: routePath,
          pageComponentName: compName,
          filePath: file.path,
        });
      }
    }

    // 3. Vue Router: { path: '/about', component: AboutView }
    if (content.includes('createRouter') || content.includes('vue-router') || file.path.includes('router')) {
      const vueMatches = content.matchAll(/path:\s*['"]([^'"]+)['"]\s*,\s*(?:name:\s*['"][^'"]+['"]\s*,\s*)?component:\s*([A-Za-z0-9_]+)/g);
      for (const m of vueMatches) {
        const routePath = m[1];
        const compName = m[2];
        routes.push({
          id: `route-${routePath}`,
          path: routePath,
          pageComponentName: compName,
          filePath: file.path,
        });
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
