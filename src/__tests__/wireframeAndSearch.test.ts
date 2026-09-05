import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseSourceWithBabel } from '@/engine/parser/babelParser';
import { buildGraphFromAnalysis } from '@/engine/graphBuilder';
import { analyzeProject } from '@/engine/analyzers';
import { createDemoProjectFiles } from '@/services/demoProject';
import { parseGitHubUrl } from '@/services/github';
import { extractZipArchive } from '@/services/fileSystem';
import { detectSnippetLanguage } from '@/features/prompt/usePromptGenerator';

describe('Wireframe extraction', () => {
  it('detects cards, badges, modals, lists, tabs, and button labels', () => {
    const code = `
      import React from 'react';

      export function ComplexUI() {
        return (
          <div className="container">
            <div className="card">
              <span className="badge">Novo</span>
              <h1>Título do Painel</h1>
              <nav className="tabs">
                <button type="button" onClick={handleTabChange}>Aba 1</button>
              </nav>
              <Modal title="Confirmar Operação">
                <input placeholder="Digite algo..." />
                <ul>
                  <li>Item A</li>
                  <li>Item B</li>
                </ul>
              </Modal>
            </div>
          </div>
        );
      }
    `;

    const result = parseSourceWithBabel(code, 'src/components/ComplexUI.tsx');
    expect(result.components).toHaveLength(1);

    const comp = result.components[0];
    const wireframeTypes = comp.wireframe.map((w) => w.type);

    expect(wireframeTypes).toContain('card');
    expect(wireframeTypes).toContain('badge');
    expect(wireframeTypes).toContain('heading');
    expect(wireframeTypes).toContain('tabs');
    expect(wireframeTypes).toContain('modal');
    expect(wireframeTypes).toContain('input');
    expect(wireframeTypes).toContain('list');
    expect(wireframeTypes).toContain('button');

    const buttonElement = comp.wireframe.find((w) => w.type === 'button');
    expect(buttonElement?.label).toBe('Aba 1');
  });
});

describe('Graph search highlighting', () => {
  it('marks matching nodes with isSearchMatch=true and non-matching nodes with isDimmed=true', () => {
    const demoFiles = createDemoProjectFiles();
    const analysis = analyzeProject(demoFiles);

    // Search for "MetricsCard"
    const { nodes } = buildGraphFromAnalysis(analysis, { searchQuery: 'metricscard' });

    expect(nodes.length).toBeGreaterThan(0);

    const matching = nodes.filter((n) => n.data.isSearchMatch);
    const dimmed = nodes.filter((n) => n.data.isDimmed);

    expect(matching.length).toBeGreaterThan(0);
    expect(matching.some((n) => n.data.label === 'MetricsCard')).toBe(true);
    expect(dimmed.length).toBeGreaterThan(0);
    // Total nodes should remain intact (structure preserved)
    expect(matching.length + dimmed.length).toBe(nodes.length);
  });
});

describe('Babel action parser', () => {
  it('extracts both function declarations and arrow function actions', () => {
    const code = `
      export function FormView() {
        function handleSubmit(e: any) {
          e.preventDefault();
        }
        const handleCancel = () => {
          console.log('canceled');
        };
        return (
          <form onSubmit={handleSubmit}>
            <button type="button" onClick={handleCancel}>Cancelar</button>
            <button type="submit">Enviar</button>
          </form>
        );
      }
    `;
    const result = parseSourceWithBabel(code, 'src/pages/FormView.tsx');
    expect(result.components).toHaveLength(1);
    const actionNames = result.actions.map((a) => a.name);
    expect(actionNames).toContain('handleSubmit');
    expect(actionNames).toContain('handleCancel');
  });
});

describe('Language syntax tags', () => {
  it('detects proper syntax tag from file extension', () => {
    expect(detectSnippetLanguage('src/components/Header.vue')).toBe('vue');
    expect(detectSnippetLanguage('src/services/api.ts')).toBe('ts');
    expect(detectSnippetLanguage('src/components/Card.tsx')).toBe('tsx');
    expect(detectSnippetLanguage('src/utils/math.js')).toBe('js');
    expect(detectSnippetLanguage('src/components/Old.jsx')).toBe('jsx');
    expect(detectSnippetLanguage('src/templates/main.html')).toBe('html');
    expect(detectSnippetLanguage('src/theme.css')).toBe('css');
    expect(detectSnippetLanguage('package.json')).toBe('json');
    expect(detectSnippetLanguage()).toBe('tsx');
  });
});

describe('GitHub URL parser & import validation', () => {
  it('parses various GitHub URL formats cleanly', () => {
    expect(parseGitHubUrl('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('https://github.com/facebook/react.git')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('git@github.com:facebook/react.git')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('git+https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('not-a-valid-url')).toBeNull();
  });

  it('rejects empty or corrupted ZIP archives gracefully', async () => {
    await expect(extractZipArchive(new ArrayBuffer(0))).rejects.toThrow('vazio');
    await expect(extractZipArchive(new Uint8Array([1, 2, 3, 4]).buffer)).rejects.toThrow('corrompido');
  });

  it('handles macOS zip archives with __MACOSX and strips root directory prefix cleanly', async () => {
    const zip = new JSZip();
    zip.file('my-project/src/App.tsx', 'export function App() { return <div>Hello</div>; }');
    zip.file('my-project/package.json', JSON.stringify({ name: 'my-project' }));
    zip.file('__MACOSX/my-project/._App.tsx', 'fake resource fork');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const files = await extractZipArchive(buffer);
    expect(files.length).toBe(2);
    expect(files.map((f) => f.path)).toContain('src/App.tsx');
    expect(files.map((f) => f.path)).toContain('package.json');
  });
});
