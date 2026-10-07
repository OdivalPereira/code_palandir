import { describe, it, expect } from 'vitest';
import { calculateArchitecturalMetrics } from '@/engine/architecturalMetrics';
import type { ProjectAnalysis, UIComponent } from '@/types/analysis';

describe('Architectural Metrics & Topologic Coupling (Galadriel & Faramir)', () => {
  const createMockComponent = (partial: Partial<UIComponent> & { name: string }): UIComponent => {
    const { name, ...rest } = partial;
    return {
      id: `comp-${name}`,
      name,
      filePath: `src/components/${name}.tsx`,
      isPage: false,
      isExported: true,
      childrenNames: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      props: [],
      wireframe: [],
      codeSnippet: `export const ${name} = () => <div />;`,
      ...rest,
    };
  };

  it('handles empty project analysis gracefully with 100% health score', () => {
    const emptyAnalysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 1,
    };

    const report = calculateArchitecturalMetrics(emptyAnalysis);
    expect(report.totalComponents).toBe(0);
    expect(report.averageInstability).toBe(0);
    expect(report.godComponentsCount).toBe(0);
    expect(report.layerViolationsCount).toBe(0);
    expect(report.overallHealthScore).toBe(100);
    expect(report.componentsMetrics).toEqual([]);
    expect(report.highestRiskComponents).toEqual([]);
  });

  it('calculates Martin Instability I = Ce / (Ca + Ce) correctly for central vs leaf components', () => {
    // Button: reutilizado por App e Dashboard (Ca = 2), não consome ninguém (Ce = 0) => I = 0 (Máxima estabilidade)
    const button = createMockComponent({
      name: 'Button',
    });

    // Dashboard: consome Button e Card (Ce = 2), ninguém o consome (Ca = 0) => I = 1 (Máxima instabilidade)
    const dashboard = createMockComponent({
      name: 'Dashboard',
      isPage: true,
      childrenNames: ['Button', 'Card'],
    });

    // App: consome Button (Ce = 1), ninguém o consome (Ca = 0) => I = 1
    const app = createMockComponent({
      name: 'App',
      childrenNames: ['Button'],
    });

    // Card: consumido por Dashboard (Ca = 1), não consome ninguém (Ce = 0) => I = 0
    const card = createMockComponent({
      name: 'Card',
    });

    const analysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [dashboard],
      components: [app, button, card],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 5,
    };

    const report = calculateArchitecturalMetrics(analysis);
    expect(report.totalComponents).toBe(4);

    const buttonMetrics = report.componentsMetrics.find((c) => c.componentName === 'Button')!;
    expect(buttonMetrics.afferentCoupling).toBe(2); // In-degree: App e Dashboard
    expect(buttonMetrics.efferentCoupling).toBe(0); // Out-degree: 0
    expect(buttonMetrics.instability).toBe(0); // I = 0 / 2 = 0
    expect(buttonMetrics.riskLevel).toBe('low');

    const dashboardMetrics = report.componentsMetrics.find((c) => c.componentName === 'Dashboard')!;
    expect(dashboardMetrics.afferentCoupling).toBe(0); // In-degree: 0
    expect(dashboardMetrics.efferentCoupling).toBe(2); // Button + Card
    expect(dashboardMetrics.instability).toBe(1); // I = 2 / 2 = 1.0
  });

  it('detects God Components with hypertrophied complexity score and actions', () => {
    const godComponent = createMockComponent({
      name: 'OmniManager',
      childrenNames: ['Header', 'Sidebar', 'UserList', 'ReportView', 'Footer', 'SettingsModal', 'AuditLog', 'FilterBar', 'NotificationCenter'],
      actions: [
        { id: 'a1', name: 'handleCreate', trigger: 'onClick', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
        { id: 'a2', name: 'handleDelete', trigger: 'onClick', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
        { id: 'a3', name: 'handleUpdate', trigger: 'onClick', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
        { id: 'a4', name: 'handleExport', trigger: 'onClick', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
        { id: 'a5', name: 'handleFilter', trigger: 'onChange', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
        { id: 'a6', name: 'handleSort', trigger: 'onClick', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
        { id: 'a7', name: 'handleBatchAction', trigger: 'onClick', componentName: 'OmniManager', filePath: 'OmniManager.tsx', codeSnippet: '', apiCalls: [], stateUpdates: [] },
      ],
      stores: [
        { id: 's1', storeName: 'useAuthStore', type: 'zustand', properties: ['user'] },
        { id: 's2', storeName: 'useProjectStore', type: 'zustand', properties: ['projects'] },
        { id: 's3', storeName: 'useNotificationStore', type: 'zustand', properties: ['alerts'] },
        { id: 's4', storeName: 'useAuditStore', type: 'zustand', properties: ['logs'] },
      ],
    });

    const analysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [godComponent],
      actions: godComponent.actions,
      hooks: [],
      stores: godComponent.stores,
      apiCalls: [],
      analysisDurationMs: 3,
    };

    const report = calculateArchitecturalMetrics(analysis);
    expect(report.godComponentsCount).toBe(1);
    expect(report.summary.highCount + report.summary.criticalCount).toBeGreaterThanOrEqual(1);

    const metrics = report.componentsMetrics[0];
    expect(metrics.isGodComponent).toBe(true);
    expect(metrics.complexityScore).toBeGreaterThanOrEqual(25);
    expect(metrics.riskLevel).toBe('critical');
    expect(metrics.reasons.some((r) => r.includes('God Component'))).toBe(true);
  });

  it('detects Layer Violations when UI components call external APIs directly', () => {
    const leakyComponent = createMockComponent({
      name: 'UserProfileWidget',
      apiCalls: [
        {
          id: 'api-1',
          endpoint: '/api/v1/users/profile',
          method: 'GET',
          client: 'fetch',
          callerComponent: 'UserProfileWidget',
          filePath: 'UserProfileWidget.tsx',
        },
      ],
    });

    const analysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [leakyComponent],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: leakyComponent.apiCalls,
      analysisDurationMs: 2,
    };

    const report = calculateArchitecturalMetrics(analysis);
    expect(report.layerViolationsCount).toBe(1);

    const metrics = report.componentsMetrics[0];
    expect(metrics.hasLayerViolation).toBe(true);
    expect(metrics.reasons.some((r) => r.includes('Violação de Camada'))).toBe(true);
  });

  it('preserves the mathematical invariant 0 <= I <= 1 for all components', () => {
    const comps = Array.from({ length: 10 }, (_, i) =>
      createMockComponent({
        name: `Comp${i}`,
        childrenNames: i > 0 ? [`Comp${i - 1}`] : [],
      })
    );

    const analysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: comps,
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 4,
    };

    const report = calculateArchitecturalMetrics(analysis);
    for (const metric of report.componentsMetrics) {
      expect(metric.instability).toBeGreaterThanOrEqual(0);
      expect(metric.instability).toBeLessThanOrEqual(1);
    }
  });

  it('calculates idempotent results on consecutive executions', () => {
    const compA = createMockComponent({ name: 'CompA', childrenNames: ['CompB'] });
    const compB = createMockComponent({ name: 'CompB' });

    const analysis: ProjectAnalysis = {
      framework: 'react',
      routes: [],
      pages: [],
      components: [compA, compB],
      actions: [],
      hooks: [],
      stores: [],
      apiCalls: [],
      analysisDurationMs: 2,
    };

    const report1 = calculateArchitecturalMetrics(analysis);
    const report2 = calculateArchitecturalMetrics(analysis);

    expect(report1).toEqual(report2);
  });
});
