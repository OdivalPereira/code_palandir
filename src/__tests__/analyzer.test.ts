import { describe, it, expect } from 'vitest';
import { analyzeProject } from '@/engine/analyzers';
import { createDemoProjectFiles } from '@/services/demoProject';

describe('analyzeProject', () => {
  it('analyzes the demo project and extracts routes, pages, and components', () => {
    const demoFiles = createDemoProjectFiles();
    const analysis = analyzeProject(demoFiles);

    expect(analysis.framework).toBe('react');

    // Should detect routes defined in App.tsx
    expect(analysis.routes.length).toBeGreaterThanOrEqual(4);
    const routePaths = analysis.routes.map((r) => r.path);
    expect(routePaths).toContain('/login');
    expect(routePaths).toContain('/dashboard');
    expect(routePaths).toContain('/reports');
    expect(routePaths).toContain('/settings');

    // Should detect pages
    expect(analysis.pages.length).toBeGreaterThanOrEqual(3);
    const pageNames = analysis.pages.map((p) => p.name);
    expect(pageNames).toContain('LoginPage');
    expect(pageNames).toContain('DashboardPage');
    expect(pageNames).toContain('ReportsPage');

    // Should detect actions (event handlers like handleSubmit, handleExportCsv)
    expect(analysis.actions.length).toBeGreaterThanOrEqual(1);
    const actionNames = analysis.actions.map((a) => a.name);
    expect(actionNames).toContain('handleSubmit');

    // Should detect API calls
    expect(analysis.apiCalls.length).toBeGreaterThanOrEqual(1);
    const apiEndpoints = analysis.apiCalls.map((a) => a.endpoint);
    expect(apiEndpoints.some((ep) => ep.includes('/api/auth/login'))).toBe(true);

    // Wireframes should be extracted
    const loginForm = [...analysis.pages, ...analysis.components].find(
      (c) => c.name === 'LoginForm'
    );
    expect(loginForm).toBeDefined();
    expect(loginForm?.wireframe.length).toBeGreaterThan(0);
  });
});
