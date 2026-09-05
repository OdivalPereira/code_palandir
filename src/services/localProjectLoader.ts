import type { ProjectFile } from '@/types/project';
import { detectLanguage } from './fileSystem';

export async function loadCurrentProjectFiles(): Promise<ProjectFile[]> {
  const modules = import.meta.glob(
    [
      '/src/**/*.{ts,tsx,js,jsx,css,json}',
      '!/src/**/*.test.*',
      '!/src/**/__tests__/**',
      '/package.json',
    ],
    { query: '?raw', import: 'default' }
  );

  const files: ProjectFile[] = [];
  for (const [rawPath, loader] of Object.entries(modules)) {
    try {
      const content = (await (loader as () => Promise<string>)()) as string;
      const cleanPath = rawPath.replace(/^\//, '');
      // Skip test files to keep analysis clean
      if (cleanPath.includes('.test.') || cleanPath.includes('__tests__')) {
        continue;
      }
      files.push({
        path: cleanPath,
        content,
        size: content.length,
        language: detectLanguage(cleanPath),
      });
    } catch (err) {
      console.warn('Failed to load file:', rawPath, err);
    }
  }
  return files;
}
