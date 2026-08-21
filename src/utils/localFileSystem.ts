import JSZip from 'jszip';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'coverage',
  '.vscode',
  '.idea'
]);

const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production'
]);

/**
 * Checks if a relative path should be ignored during directory traversal.
 */
export function shouldIgnorePath(path: string): boolean {
  const parts = path.split('/');
  for (const part of parts) {
    if (IGNORED_DIRECTORIES.has(part)) return true;
    if (IGNORED_FILES.has(part)) return true;
    if (part.startsWith('.') && part !== '.' && part !== '..') return true;
  }
  return false;
}

/**
 * Ingests a local directory using the modern File System Access API (showDirectoryPicker).
 * Supports browser-native recursive directory reading without server upload.
 */
export async function openDirectoryPicker(): Promise<File[]> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API is not supported in this browser. Please use the file upload fallback.');
  }

  // @ts-ignore
  const dirHandle = await (window as any).showDirectoryPicker();
  const files: File[] = [];

  async function readDirectory(handle: any, currentPath: string = '') {
    // @ts-ignore
    for await (const entry of handle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      if (shouldIgnorePath(entryPath)) continue;

      if (entry.kind === 'file') {
        const file = await entry.getFile();
        // Attach relative path for graph processor compatibility
        Object.defineProperty(file, 'webkitRelativePath', {
          value: entryPath,
          writable: false
        });
        files.push(file);
      } else if (entry.kind === 'directory') {
        await readDirectory(entry, entryPath);
      }
    }
  }

  await readDirectory(dirHandle);
  return files;
}

/**
 * Extracts and unpacks a .ZIP archive in-memory in the browser.
 * Enables offline code analysis for zipped repositories.
 */
export async function extractZipFile(zipFile: File): Promise<File[]> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(zipFile);
  const files: File[] = [];

  // Determine if there is a single top-level root folder in the zip (like GitHub downloads: repo-main/...)
  const entries = Object.keys(zipContent.files);
  const firstLevelDirs = new Set<string>();
  entries.forEach(name => {
    const parts = name.split('/').filter(Boolean);
    if (parts.length > 0) {
      firstLevelDirs.add(parts[0]);
    }
  });
  const hasSingleRoot = firstLevelDirs.size === 1 && entries.every(e => e.startsWith([...firstLevelDirs][0] + '/'));
  const rootPrefix = hasSingleRoot ? [...firstLevelDirs][0] + '/' : '';

  for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
    if (zipEntry.dir) continue;
    let cleanPath = relativePath;
    if (rootPrefix && cleanPath.startsWith(rootPrefix)) {
      cleanPath = cleanPath.slice(rootPrefix.length);
    }
    if (!cleanPath || shouldIgnorePath(cleanPath)) continue;

    const blob = await zipEntry.async('blob');
    const filename = cleanPath.split('/').pop() || 'file';
    const file = new File([blob], filename, {
      type: blob.type || 'text/plain',
      lastModified: zipEntry.date ? zipEntry.date.getTime() : Date.now()
    });

    Object.defineProperty(file, 'webkitRelativePath', {
      value: cleanPath,
      writable: false
    });
    files.push(file);
  }

  return files;
}
