import { describe, it, expect } from 'vitest';
import { detectNextAppRoutes } from '@/engine/analyzers/nextAppRouterDetector';
import { detectRoutes } from '@/engine/analyzers/routeDetector';
import type { ProjectFile } from '@/types/project';
import type { UIComponent } from '@/types/analysis';

describe('Next.js App Router Detector (Aragorn & Celebrimbor)', () => {
  const mockComponents: UIComponent[] = [
    {
      id: 'comp-1',
      name: 'HomePage',
      filePath: 'src/app/page.tsx',
      isPage: true,
      isExported: true,
      childrenNames: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      props: [],
      wireframe: [],
      codeSnippet: 'export default function Home() { return <div>Home</div>; }',
    },
    {
      id: 'comp-2',
      name: 'LoginPage',
      filePath: 'src/app/(auth)/login/page.tsx',
      isPage: true,
      isExported: true,
      childrenNames: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      props: [],
      wireframe: [],
      codeSnippet: "'use client';\nexport default function Login() { return <form />; }",
    },
    {
      id: 'comp-3',
      name: 'UserDetailPage',
      filePath: 'src/app/users/[id]/page.tsx',
      isPage: true,
      isExported: true,
      childrenNames: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      props: [],
      wireframe: [],
      codeSnippet: 'export default function UserDetail() { return <div>User</div>; }',
    },
  ];

  it('detects root page app/page.tsx correctly as "/"', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/app/page.tsx',
        content: 'export default function Home() { return <div>Home</div>; }',
        size: 100,
        language: 'tsx',
      },
    ];

    const { routes, appRoutesInfo } = detectNextAppRoutes(files, mockComponents);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/');
    expect(routes[0].pageComponentName).toBe('HomePage');

    expect(appRoutesInfo[0].isClientComponent).toBe(false);
    expect(appRoutesInfo[0].isDynamic).toBe(false);
  });

  it('strips Route Groups like (auth) from the canonical URL path', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/app/(auth)/login/page.tsx',
        content: "'use client';\nexport default function Login() { return <form />; }",
        size: 120,
        language: 'tsx',
      },
    ];

    const { routes, appRoutesInfo } = detectNextAppRoutes(files, mockComponents);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/login'); // Not '/(auth)/login'
    expect(appRoutesInfo[0].routeGroups).toEqual(['auth']);
    expect(appRoutesInfo[0].isClientComponent).toBe(true);
  });

  it('extracts dynamic parameters and catch-all routes correctly', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/app/users/[id]/page.tsx',
        content: 'export default function UserDetail() { return <div />; }',
        size: 100,
        language: 'tsx',
      },
      {
        path: 'src/app/docs/[...slug]/page.tsx',
        content: 'export default function Docs() { return <div />; }',
        size: 100,
        language: 'tsx',
      },
      {
        path: 'src/app/shop/[[...category]]/page.tsx',
        content: 'export default function Shop() { return <div />; }',
        size: 100,
        language: 'tsx',
      },
    ];

    const { routes, appRoutesInfo } = detectNextAppRoutes(files, mockComponents);
    expect(routes).toHaveLength(3);

    const userRoute = appRoutesInfo.find((r) => r.filePath.includes('users/[id]'))!;
    expect(userRoute.path).toBe('/users/:id');
    expect(userRoute.isDynamic).toBe(true);
    expect(userRoute.paramNames).toEqual(['id']);

    const docsRoute = appRoutesInfo.find((r) => r.filePath.includes('docs/[...slug]'))!;
    expect(docsRoute.path).toBe('/docs/*slug');
    expect(docsRoute.paramNames).toEqual(['slug']);

    const shopRoute = appRoutesInfo.find((r) => r.filePath.includes('shop/[[...category]]'))!;
    expect(shopRoute.path).toBe('/shop/*category?');
    expect(shopRoute.paramNames).toEqual(['category']);
  });

  it('identifies layouts, loadings and errors associated with routes', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/app/layout.tsx',
        content: 'export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }',
        size: 150,
        language: 'tsx',
      },
      {
        path: 'src/app/dashboard/layout.tsx',
        content: 'export default function DashboardLayout({ children }) { return <section>{children}</section>; }',
        size: 140,
        language: 'tsx',
      },
      {
        path: 'src/app/dashboard/loading.tsx',
        content: 'export default function Loading() { return <div>Loading...</div>; }',
        size: 80,
        language: 'tsx',
      },
      {
        path: 'src/app/dashboard/page.tsx',
        content: 'export default function DashboardPage() { return <div>Dashboard</div>; }',
        size: 110,
        language: 'tsx',
      },
    ];

    const { appRoutesInfo } = detectNextAppRoutes(files, []);
    const dashRoute = appRoutesInfo.find((r) => r.path === '/dashboard')!;
    expect(dashRoute).toBeDefined();
    expect(dashRoute.hasLayout).toBe(true);
    expect(dashRoute.layoutFilePath).toBe('src/app/dashboard/layout.tsx');
    expect(dashRoute.hasLoading).toBe(true);
  });

  it('detects Next.js API routes (route.ts)', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/app/api/webhooks/stripe/route.ts',
        content: 'export async function POST(req) { return Response.json({ ok: true }); }',
        size: 100,
        language: 'tsx',
      },
    ];

    const { routes, appRoutesInfo } = detectNextAppRoutes(files, []);
    expect(routes).toHaveLength(0); // API routes are not UI Page routes
    expect(appRoutesInfo).toHaveLength(1);
    expect(appRoutesInfo[0].isApiRoute).toBe(true);
    expect(appRoutesInfo[0].path).toBe('/api/webhooks/stripe');
  });

  it('integrates seamlessly into detectRoutes without regressions', () => {
    const files: ProjectFile[] = [
      {
        path: 'app/settings/page.tsx',
        content: 'export default function Settings() { return <div>Settings</div>; }',
        size: 100,
        language: 'tsx',
      },
      {
        path: 'src/pages/about.tsx',
        content: 'export default function About() { return <div>About</div>; }',
        size: 100,
        language: 'tsx',
      },
    ];

    const detected = detectRoutes(files, []);
    const paths = detected.map((r) => r.path);
    expect(paths).toContain('/settings');
    expect(paths).toContain('/about');
  });
});
