import type { ProjectFile } from '@/types/project';
import type { UIComponent } from '@/types/analysis';
import type { FrameworkAnalyzer } from './types';
import { parseSourceWithBabel } from '../parser/babelParser';

export class ReactAnalyzer implements FrameworkAnalyzer {
  canHandle(file: ProjectFile): boolean {
    const p = file.path.toLowerCase();
    return (
      p.endsWith('.tsx') ||
      p.endsWith('.jsx') ||
      (p.endsWith('.ts') && !p.endsWith('.d.ts') && !p.endsWith('.test.ts')) ||
      (p.endsWith('.js') && !p.endsWith('.test.js'))
    );
  }

  analyzeComponents(file: ProjectFile): UIComponent[] {
    const result = parseSourceWithBabel(file.content, file.path);
    return result.components;
  }
}
