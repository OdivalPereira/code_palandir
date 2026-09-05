import type { ProjectFile, SupportedFramework } from '@/types/project';

export function detectFramework(files: ProjectFile[]): SupportedFramework {
  // 1. Check package.json if present
  const packageJsonFile = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (packageJsonFile) {
    try {
      const pkg = JSON.parse(packageJsonFile.content);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      if (allDeps['next']) return 'nextjs';
      if (allDeps['nuxt'] || allDeps['nuxt3']) return 'nuxtjs';
      if (allDeps['@angular/core']) return 'angular';
      if (allDeps['svelte'] || allDeps['@sveltejs/kit']) return 'svelte';
      if (allDeps['vue']) return 'vue';
      if (allDeps['react']) return 'react';
    } catch {
      // ignore parse error and fallback to file heuristics
    }
  }

  // 2. Heuristics based on file extensions and patterns
  let hasVue = false;
  let hasAngular = false;
  let hasReact = false;
  let hasNext = false;
  let hasSvelte = false;

  for (const file of files) {
    const p = file.path.toLowerCase();
    if (p.endsWith('.vue')) hasVue = true;
    if (p.endsWith('.component.ts') || p.includes('angular.json')) hasAngular = true;
    if (p.endsWith('.svelte')) hasSvelte = true;
    if (p.endsWith('.tsx') || p.endsWith('.jsx')) hasReact = true;
    if (
      p.includes('next.config.') ||
      (/(?:^|\/)pages\/.+\.(?:tsx|jsx|js|ts)$/i.test(p) && (p.includes('_app') || p.includes('_document'))) ||
      /(?:^|\/)app\/(?:.+[\\/])?page\.(?:tsx|jsx|js|ts)$/i.test(p) ||
      /(?:^|\/)app\/(?:.+[\\/])?layout\.(?:tsx|jsx|js|ts)$/i.test(p)
    ) {
      if (hasReact) hasNext = true;
    }
  }

  if (hasNext) return 'nextjs';
  if (hasAngular) return 'angular';
  if (hasVue) return 'vue';
  if (hasSvelte) return 'svelte';
  if (hasReact) return 'react';

  return 'react'; // default fallback for modern frontend projects
}
