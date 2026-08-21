import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { shouldIgnorePath, extractZipFile } from '../localFileSystem';

describe('localFileSystem', () => {
  describe('shouldIgnorePath', () => {
    it('should ignore node_modules and .git directories', () => {
      expect(shouldIgnorePath('node_modules/react/index.js')).toBe(true);
      expect(shouldIgnorePath('.git/config')).toBe(true);
      expect(shouldIgnorePath('dist/bundle.js')).toBe(true);
      expect(shouldIgnorePath('src/.DS_Store')).toBe(true);
    });

    it('should allow source files', () => {
      expect(shouldIgnorePath('src/components/App.tsx')).toBe(false);
      expect(shouldIgnorePath('package.json')).toBe(false);
      expect(shouldIgnorePath('README.md')).toBe(false);
    });
  });

  describe('extractZipFile', () => {
    it('should unpack in-memory zip archive into File objects', async () => {
      const zip = new JSZip();
      zip.file('src/index.ts', 'console.log("hello");');
      zip.file('package.json', '{"name": "test-repo"}');
      zip.file('node_modules/dummy.js', 'ignore me');

      const blob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([blob], 'project.zip', { type: 'application/zip' });

      const files = await extractZipFile(zipFile);
      expect(files.length).toBe(2);
      const paths = files.map(f => f.webkitRelativePath);
      expect(paths).toContain('src/index.ts');
      expect(paths).toContain('package.json');
      expect(paths).not.toContain('node_modules/dummy.js');
    });

    it('should strip common root prefix from github zip archives', async () => {
      const zip = new JSZip();
      zip.file('my-repo-main/src/App.tsx', 'export const App = () => null;');
      zip.file('my-repo-main/package.json', '{}');

      const blob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([blob], 'my-repo-main.zip', { type: 'application/zip' });

      const files = await extractZipFile(zipFile);
      expect(files.length).toBe(2);
      const paths = files.map(f => f.webkitRelativePath);
      expect(paths).toContain('src/App.tsx');
      expect(paths).toContain('package.json');
    });
  });
});
