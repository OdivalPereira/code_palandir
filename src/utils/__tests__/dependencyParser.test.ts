import { describe, it, expect } from 'vitest';
import { buildSemanticLinksForFile, resolveImportTarget, normalizePath } from '../../dependencyParser';

describe('dependencyParser', () => {
  describe('normalizePath', () => {
    it('should resolve relative components correctly', () => {
      expect(normalizePath('src/components/../utils/helper.ts')).toBe('src/utils/helper.ts');
      expect(normalizePath('./src/./index.ts')).toBe('src/index.ts');
    });
  });

  describe('resolveImportTarget', () => {
    const filePaths = new Set([
      'src/components/Button.tsx',
      'src/utils/index.ts',
      'src/types.ts'
    ]);

    it('should resolve relative imports with extension inference', () => {
      const resolved = resolveImportTarget('src/components/Header.tsx', './Button', filePaths);
      expect(resolved).toBe('src/components/Button.tsx');
    });

    it('should resolve index file directory imports', () => {
      const resolved = resolveImportTarget('src/App.tsx', './utils', filePaths);
      expect(resolved).toBe('src/utils/index.ts');
    });

    it('should resolve alias @/ imports', () => {
      const resolved = resolveImportTarget('src/components/Button.tsx', '@/types', filePaths);
      expect(resolved).toBe('src/types.ts');
    });
  });

  describe('buildSemanticLinksForFile', () => {
    const filePaths = new Set([
      'src/App.tsx',
      'src/components/Button.tsx'
    ]);
    const symbolIndex = new Map<string, string[]>();

    it('should extract import links without duplicates', () => {
      const content = `
        import React from 'react';
        import { Button } from './components/Button';
        import './components/Button';
      `;

      const { links } = buildSemanticLinksForFile({
        sourcePath: 'src/App.tsx',
        content,
        filePaths,
        symbolIndex
      });

      expect(links.length).toBe(1);
      expect(links[0].source).toBe('src/App.tsx');
      expect(links[0].target).toBe('src/components/Button.tsx');
      expect(links[0].kind).toBe('import');
    });
  });
});
