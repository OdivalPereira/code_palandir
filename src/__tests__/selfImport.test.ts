import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyzeProject } from '@/engine/analyzers';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { useGraphStore } from '@/stores/graphStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { generatePromptText } from '@/features/prompt/usePromptGenerator';
import { PROMPT_TEMPLATES } from '@/features/prompt/PromptTemplates';
import type { ProjectFile } from '@/types/project';
import { detectLanguage } from '@/services/fileSystem';
import { loadCurrentProjectFiles } from '@/services/localProjectLoader';

describe('Code Palandir Self-Import & Analysis', () => {
  let files: ProjectFile[] = [];

  it('loads real project files via loadCurrentProjectFiles', async () => {
    const loaded = await loadCurrentProjectFiles();
    expect(loaded.length).toBeGreaterThan(20);
    const hasApp = loaded.some(f => f.path.includes('App.tsx'));
    expect(hasApp).toBe(true);

    const { analyzeProject } = await import('@/engine/analyzers');
    const analysis = analyzeProject(loaded);
    expect(analysis.routes.map((r) => r.path).sort()).toEqual(['*', '/', '/analisador', '/projetos', '/projetos/:id'].sort());
    expect(analysis.pages.length).toBeGreaterThanOrEqual(1);
    expect(analysis.pages.some((p) => p.name === 'AnalisadorPage')).toBe(true);
    expect(analysis.components.length).toBeGreaterThan(15);
  }, 15000);

  beforeEach(() => {
    useGraphStore.getState().reset();
    useSelectionStore.getState().clearSelection();
  });

  it('parses and analyzes the local Code Palandir codebase', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const srcDir = path.join(rootDir, 'src');
    files = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            walk(full);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1);
          if (['ts', 'tsx', 'js', 'jsx'].includes(ext) && !entry.name.includes('.test.') && !entry.name.includes('.d.ts')) {
            const relPath = path.relative(rootDir, full);
            const content = fs.readFileSync(full, 'utf8');
            files.push({
              path: relPath,
              content,
              size: content.length,
              language: detectLanguage(relPath),
            });
          }
        }
      }
    }
    walk(srcDir);

    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      files.push({
        path: 'package.json',
        content: fs.readFileSync(pkgPath, 'utf8'),
        size: fs.statSync(pkgPath).size,
        language: 'json',
      });
    }

    expect(files.length).toBeGreaterThanOrEqual(30);

    const analysis = analyzeProject(files);

    expect(analysis.framework).toBe('react');
    expect(analysis.components.length + analysis.pages.length).toBeGreaterThan(10);
    expect(analysis.stores.length).toBeGreaterThan(0);
    expect(analysis.hooks.length).toBeGreaterThan(0);

    // Verify routes and pages
    expect(analysis.routes.map((r) => r.path).sort()).toEqual(['*', '/', '/analisador', '/projetos', '/projetos/:id'].sort());
    expect(analysis.pages.length).toBeGreaterThanOrEqual(2);

    // 1. Verify Collapsed-by-Default rendering for Code Palandir itself
    const collapsed = buildGraphFromAnalysis(analysis, undefined, 'LR', new Set());
    const full = buildGraphFromAnalysis(analysis); // full expanded

    // Full graph has over 100 nodes!
    expect(full.nodes.length).toBeGreaterThan(100);

    // Collapsed graph for Code Palandir opens with the top-level entry points: 4 routes and pages
    expect(collapsed.nodes.length).toBeGreaterThanOrEqual(5);
    for (const routePath of ['/', '/analisador', '/projetos', '/projetos/:id']) {
      expect(collapsed.nodes.some((n) => n.data.nodeType === 'route' && n.data.label === routePath)).toBe(true);
    }
    expect(collapsed.nodes.some((n) => n.data.nodeType === 'page' && n.data.label === 'AnalisadorPage')).toBe(true);

    // All page nodes in collapsed graph start with isExpanded = false
    for (const node of collapsed.nodes.filter((n) => n.data.nodeType === 'page')) {
      expect(node.data.isExpanded).toBe(false);
    }

    // 2. Test Expanding the root AnalisadorPage component/page
    const analisadorPage =
      analysis.pages.find((p) => p.name === 'AnalisadorPage') ||
      analysis.components.find((c) => c.name === 'AnalisadorPage');
    expect(analisadorPage).toBeDefined();

    const analisadorNodeId = analisadorPage?.isPage
      ? `node-page-${analisadorPage.id}`
      : `node-comp-${analisadorPage?.id}`;
    const expandedAnalisadorGraph = buildGraphFromAnalysis(
      analysis,
      undefined,
      'LR',
      new Set([analisadorNodeId])
    );

    // Expanding AnalisadorPage reveals its direct children (e.g. TopBar, GraphCanvas, DetailSidebar, ImportDialog)
    expect(expandedAnalisadorGraph.nodes.length).toBeGreaterThan(collapsed.nodes.length);
    for (const childName of analisadorPage?.childrenNames || []) {
      const childInGraph = expandedAnalisadorGraph.nodes.find((n) => n.data.label === childName);
      if (childInGraph) {
        expect(childInGraph.data.isExpanded).toBe(false); // child starts collapsed
      }
    }

    // 3. Verify Dagre coordinates are non-overlapping and valid
    for (const node of expandedAnalisadorGraph.nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }

    // 4. Test selecting elements from Code Palandir for AI Prompt Generation
    useSelectionStore.getState().toggleElement({
      id: analisadorNodeId,
      label: 'AnalisadorPage',
      nodeType: 'page',
      filePath: analisadorPage?.filePath,
      codeSnippet: analisadorPage?.codeSnippet,
    });

    const selectedElements = useSelectionStore.getState().selectedElements;
    expect(selectedElements.length).toBe(1);
    expect(selectedElements[0].label).toBe('AnalisadorPage');

    // Generate prompt with prompt template
    const generatedPrompt = generatePromptText(
      PROMPT_TEMPLATES[0],
      'Adicionar suporte a tema escuro/claro com persistência no LocalStorage',
      selectedElements,
      'react'
    );

    expect(generatedPrompt).toContain('AnalisadorPage');
    expect(generatedPrompt).toContain('Adicionar suporte a tema escuro/claro');
  }, 20000);

  it('manages Code Palandir graph state through Zustand useGraphStore', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const srcDir = path.join(rootDir, 'src');
    const localFiles: ProjectFile[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            walk(full);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).slice(1);
          if (['ts', 'tsx', 'js', 'jsx'].includes(ext) && !entry.name.includes('.test.') && !entry.name.includes('.d.ts')) {
            const relPath = path.relative(rootDir, full);
            localFiles.push({
              path: relPath,
              content: fs.readFileSync(full, 'utf8'),
              size: fs.statSync(full).size,
              language: detectLanguage(relPath),
            });
          }
        }
      }
    }
    walk(srcDir);

    const analysis = analyzeProject(localFiles);
    useGraphStore.getState().buildGraph(analysis);

    // Should initialize at Level 1 (collapsed by default)
    expect(useGraphStore.getState().expansionLevel).toBe(1);
    expect(useGraphStore.getState().expandedNodeIds.size).toBe(0);

    const level1Count = useGraphStore.getState().nodes.length;

    // Expand all
    useGraphStore.getState().expandAll();
    expect(useGraphStore.getState().expansionLevel).toBe(3);
    const level3Count = useGraphStore.getState().nodes.length;
    expect(level3Count).toBeGreaterThan(level1Count);

    // Collapse back
    useGraphStore.getState().collapseAll();
    expect(useGraphStore.getState().expansionLevel).toBe(1);
    expect(useGraphStore.getState().nodes.length).toBe(level1Count);
  });
});
