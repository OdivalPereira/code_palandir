import { describe, it, expect } from 'vitest';
import { detectFramework } from '@/engine/analyzers/frameworkDetector';
import type { ProjectFile } from '@/types/project';

describe('detectFramework', () => {
  it('detects React from package.json', () => {
    const files: ProjectFile[] = [
      {
        path: 'package.json',
        language: 'json',
        size: 100,
        content: JSON.stringify({ dependencies: { react: '^18.2.0' } }),
      },
    ];
    expect(detectFramework(files)).toBe('react');
  });

  it('detects Next.js when next is in dependencies', () => {
    const files: ProjectFile[] = [
      {
        path: 'package.json',
        language: 'json',
        size: 100,
        content: JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.2.0' } }),
      },
    ];
    expect(detectFramework(files)).toBe('nextjs');
  });

  it('detects Vue from .vue files', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/components/UserCard.vue',
        language: 'vue',
        size: 100,
        content: '<template><div>User</div></template>',
      },
    ];
    expect(detectFramework(files)).toBe('vue');
  });

  it('detects Angular from .component.ts files', () => {
    const files: ProjectFile[] = [
      {
        path: 'src/app/login/login.component.ts',
        language: 'typescript',
        size: 100,
        content: '@Component({ selector: "app-login" }) export class LoginComponent {}',
      },
    ];
    expect(detectFramework(files)).toBe('angular');
  });
});
