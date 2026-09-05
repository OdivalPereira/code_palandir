import JSZip from 'jszip';
import type { ProjectFile } from '@/types/project';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  '.output',
  '.cache',
]);

const ALLOWED_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'vue',
  'svelte',
  'html',
  'css',
  'json',
]);

function shouldIgnorePath(path: string): boolean {
  const parts = path.split('/');
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return true;
  }
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

function detectLanguage(path: string): ProjectFile['language'] {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'tsx':
      return 'tsx';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'js':
      return 'javascript';
    case 'vue':
      return 'vue';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    default:
      return 'other';
  }
}

export async function readDirectoryWithPicker(): Promise<ProjectFile[]> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API não é suportado neste navegador. Use a opção de importar ZIP.');
  }

  // @ts-expect-error File System Access API
  const dirHandle = await window.showDirectoryPicker();
  const files: ProjectFile[] = [];

  async function scan(handle: any, currentPath: string) {
    for await (const entry of handle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        if (!IGNORED_DIRS.has(entry.name)) {
          await scan(entry, entryPath);
        }
      } else if (entry.kind === 'file') {
        if (!shouldIgnorePath(entryPath)) {
          const file = await entry.getFile();
          // Skip files larger than 1MB to keep processing snappy
          if (file.size < 1024 * 1024) {
            const content = await file.text();
            files.push({
              path: entryPath,
              content,
              size: file.size,
              language: detectLanguage(entryPath),
            });
          }
        }
      }
    }
  }

  await scan(dirHandle, '');
  return files;
}

export async function extractZipArchive(zipBuffer: ArrayBuffer): Promise<ProjectFile[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files: ProjectFile[] = [];

  // Determine if there's a common root folder (e.g. from GitHub zipball)
  const allEntries = Object.keys(zip.files);
  const firstSlashIndex = allEntries[0]?.indexOf('/') ?? -1;
  const commonPrefix = firstSlashIndex !== -1 ? allEntries[0].slice(0, firstSlashIndex + 1) : '';

  for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

    // Remove root folder prefix if present
    let relativePath = rawPath;
    if (commonPrefix && relativePath.startsWith(commonPrefix)) {
      relativePath = relativePath.slice(commonPrefix.length);
    }

    if (!relativePath || shouldIgnorePath(relativePath)) continue;

    const content = await zipEntry.async('string');
    files.push({
      path: relativePath,
      content,
      size: content.length,
      language: detectLanguage(relativePath),
    });
  }

  return files;
}
