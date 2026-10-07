import type { ProjectFile } from '@/types/project';
import type { UIRoute, UIComponent } from '@/types/analysis';

export interface NextAppRouteInfo {
  id: string;
  path: string;
  pageComponentName: string;
  filePath: string;
  isClientComponent: boolean;
  isDynamic: boolean;
  paramNames: string[];
  routeGroups: string[];
  hasLayout: boolean;
  layoutFilePath?: string;
  hasLoading: boolean;
  hasError: boolean;
  isApiRoute: boolean;
}

/**
 * Analisador e Detector Avançado de Rotas para Next.js 13/14/15 (App Router).
 * Desenvolvido no padrão Sociedade do Código para o Code Palandir.
 *
 * Trata as convenções completas do App Router:
 * - Páginas: app/page.tsx -> /
 * - Subpastas: app/dashboard/settings/page.tsx -> /dashboard/settings
 * - Route Groups: app/(auth)/login/page.tsx -> /login (ignora parênteses na URL)
 * - Parâmetros Dinâmicos: app/users/[id]/page.tsx -> /users/:id
 * - Catch-all: app/docs/[...slug]/page.tsx -> /docs/*slug
 * - Optional Catch-all: app/shop/[[...category]]/page.tsx -> /shop/*category?
 * - Diretiva 'use client' vs Server Components
 * - Detecção de layouts aninhados (layout.tsx), loading (loading.tsx) e erros (error.tsx)
 * - Rotas de API (route.ts / route.js)
 */
export function detectNextAppRoutes(
  files: ProjectFile[],
  components: UIComponent[]
): { routes: UIRoute[]; appRoutesInfo: NextAppRouteInfo[] } {
  const routes: UIRoute[] = [];
  const appRoutesInfo: NextAppRouteInfo[] = [];

  const fileMap = new Map<string, ProjectFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
  }

  // Regex para arquivos no App Router (com suporte opcional a src/)
  const appFileRegex = /^(?:.*\/)?(?:src\/)?app\/(.+)$/i;

  // 1. Mapeamento de layouts, loadings e errors existentes por diretório relativo
  const dirLayoutMap = new Map<string, string>();
  const dirLoadingMap = new Map<string, string>();
  const dirErrorMap = new Map<string, string>();

  for (const file of files) {
    const match = file.path.match(appFileRegex);
    if (!match) continue;

    const relative = match[1];
    const parts = relative.split('/');
    const filename = parts.pop() || '';
    const dir = parts.join('/');

    if (/^layout\.(?:tsx|jsx|js|ts)$/i.test(filename)) {
      dirLayoutMap.set(dir, file.path);
    } else if (/^loading\.(?:tsx|jsx|js|ts)$/i.test(filename)) {
      dirLoadingMap.set(dir, file.path);
    } else if (/^error\.(?:tsx|jsx|js|ts)$/i.test(filename)) {
      dirErrorMap.set(dir, file.path);
    }
  }

  // 2. Processamento de páginas (page.tsx) e rotas de API (route.ts)
  for (const file of files) {
    const match = file.path.match(appFileRegex);
    if (!match) continue;

    const relative = match[1];
    const isPage = /(?:^|\/)page\.(?:tsx|jsx|js|ts)$/i.test(relative);
    const isApiRoute = /(?:^|\/)route\.(?:tsx|jsx|js|ts)$/i.test(relative);

    if (!isPage && !isApiRoute) continue;

    const parts = relative.split('/');
    parts.pop(); // remove 'page.tsx' ou 'route.ts'
    const dir = parts.join('/');

    // Processa segmentos de rota
    const routeGroups: string[] = [];
    const paramNames: string[] = [];
    const cleanSegments: string[] = [];
    let isDynamic = false;

    for (const segment of parts) {
      // Ignora Parallel Routes (ex: @modal, @slot)
      if (segment.startsWith('@')) {
        continue;
      }

      // Route Group: (marketing), (auth) -> não entra no path final da URL
      if (segment.startsWith('(') && segment.endsWith(')')) {
        routeGroups.push(segment.slice(1, -1));
        continue;
      }

      // Optional Catch-all: [[...slug]]
      if (segment.startsWith('[[...') && segment.endsWith(']]')) {
        const paramName = segment.slice(5, -2);
        paramNames.push(paramName);
        cleanSegments.push(`*${paramName}?`);
        isDynamic = true;
        continue;
      }

      // Catch-all: [...slug]
      if (segment.startsWith('[...') && segment.endsWith(']')) {
        const paramName = segment.slice(4, -1);
        paramNames.push(paramName);
        cleanSegments.push(`*${paramName}`);
        isDynamic = true;
        continue;
      }

      // Dynamic Param: [id]
      if (segment.startsWith('[') && segment.endsWith(']')) {
        const paramName = segment.slice(1, -1);
        paramNames.push(paramName);
        cleanSegments.push(`:${paramName}`);
        isDynamic = true;
        continue;
      }

      // Segmento estático comum
      cleanSegments.push(segment);
    }

    let urlPath = '/' + cleanSegments.join('/');
    if (urlPath.length > 1 && urlPath.endsWith('/')) {
      urlPath = urlPath.slice(0, -1);
    }
    if (!urlPath) {
      urlPath = '/';
    }

    // Detecção de Client Component ('use client')
    const content = file.content.trim();
    const isClientComponent = /^(?:'use client'|"use client");?/m.test(content);

    // Resolução de layout mais próximo subindo na hierarquia de pastas
    let nearestLayout: string | undefined = undefined;
    const searchDirs = [...parts];
    while (searchDirs.length >= 0) {
      const currentDir = searchDirs.join('/');
      if (dirLayoutMap.has(currentDir)) {
        nearestLayout = dirLayoutMap.get(currentDir);
        break;
      }
      if (searchDirs.length === 0) break;
      searchDirs.pop();
    }

    const hasLayout = Boolean(nearestLayout);
    const hasLoading = dirLoadingMap.has(dir);
    const hasError = dirErrorMap.has(dir);

    // Resolução do componente correspondente
    const matchingComponent = components.find((c) => c.filePath === file.path);
    const componentName =
      matchingComponent?.name || inferAppRouterComponentName(file.path, isApiRoute);

    const routeId = isApiRoute ? `api-route-${urlPath}` : `route-${urlPath}`;

    const appRouteInfo: NextAppRouteInfo = {
      id: routeId,
      path: urlPath,
      pageComponentName: componentName,
      filePath: file.path,
      isClientComponent,
      isDynamic,
      paramNames,
      routeGroups,
      hasLayout,
      layoutFilePath: nearestLayout,
      hasLoading,
      hasError,
      isApiRoute,
    };

    appRoutesInfo.push(appRouteInfo);

    // Se for rota de página, adiciona ao UIRoute padrão do projeto
    if (isPage) {
      routes.push({
        id: routeId,
        path: urlPath,
        pageComponentName: componentName,
        filePath: file.path,
      });
    }
  }

  return { routes, appRoutesInfo };
}

function inferAppRouterComponentName(filePath: string, isApiRoute: boolean): string {
  if (isApiRoute) {
    return 'ApiRouteHandler';
  }
  const parts = filePath.split('/');
  parts.pop(); // remove 'page.tsx'
  const lastFolder = parts.pop() || 'Home';

  // Sanitiza nomes com parâmetros ou grupos
  const cleanName = lastFolder
    .replace(/[\[\]\(\)\.]/g, '')
    .replace(/^@/, '');

  if (!cleanName || cleanName.toLowerCase() === 'app') {
    return 'HomePage';
  }

  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1) + 'Page';
}
