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
  '__MACOSX',
  '.svn',
  '.hg',
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

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /\.(?:pem|key|pkcs12|pfx|p12|kdbx|crt|cer|jks)$/i,
  /(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.pub)?$/i,
  /(?:secret|credential|service-account|firebase-adminsdk|private-key).*\.json$/i,
  /\.htpasswd$/i,
  /\.npmrc$/i,
  /\.dockercfg$/i,
  /\.netrc$/i,
  /\.git-credentials$/i,
  /credentials(?:\.json|\.ini|\.txt)?$/i,
];

export function isSensitivePath(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || normalized;
  return SENSITIVE_FILE_PATTERNS.some((pat) => pat.test(filename));
}

export function sanitizeFilePath(rawPath: string): string {
  if (!rawPath) return '';
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  const safeSegments: string[] = [];
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      continue;
    }
    const cleaned = seg.replace(/[\x00-\x1f\x7f]/g, '');
    if (cleaned) {
      safeSegments.push(cleaned);
    }
  }
  return safeSegments.join('/');
}

export function shouldIgnorePath(path: string): boolean {
  if (!path) return true;
  if (isSensitivePath(path)) return true;
  const parts = path.split('/');
  for (const part of parts) {
    if (IGNORED_DIRS.has(part) || part.startsWith('._') || part === '..') return true;
  }
  const filename = parts[parts.length - 1];
  if (filename.startsWith('._') || filename === '.DS_Store' || isSensitivePath(filename)) return true;
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

export function detectLanguage(path: string): ProjectFile['language'] {
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
    throw new Error('A API File System Access não é suportada por este navegador. Por favor, utilize a opção de upload de arquivo .ZIP ou repositório do GitHub.');
  }

  let dirHandle: any;
  try {
    // @ts-expect-error File System Access API
    dirHandle = await window.showDirectoryPicker();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err; // User closed picker
    }
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      throw new Error('Permissão negada para acessar a pasta selecionada. Verifique as permissões do navegador ou importe via arquivo .ZIP.');
    }
    throw new Error(`Não foi possível abrir a pasta: ${err?.message || 'Erro desconhecido'}`);
  }

  const files: ProjectFile[] = [];

  async function scan(handle: any, currentPath: string) {
    try {
      for await (const entry of handle.values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        if (entry.kind === 'directory') {
          if (!IGNORED_DIRS.has(entry.name)) {
            await scan(entry, entryPath);
          }
        } else if (entry.kind === 'file') {
          if (!shouldIgnorePath(entryPath)) {
            try {
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
            } catch {
              // Ignore single file read failure and continue scanning
            }
          }
        }
      }
    } catch (scanErr: any) {
      console.warn('Erro durante leitura de diretório:', scanErr);
    }
  }

  await scan(dirHandle, '');

  if (files.length === 0) {
    throw new Error('Nenhum arquivo de código suportado (.tsx, .jsx, .ts, .js, .vue, .html) foi encontrado nesta pasta. Certifique-se de selecionar a pasta raiz do projeto.');
  }

  return files;
}

export async function extractZipArchive(zipBuffer: ArrayBuffer): Promise<ProjectFile[]> {
  if (!zipBuffer || zipBuffer.byteLength === 0) {
    throw new Error('O arquivo ZIP fornecido está vazio (0 bytes).');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (err: any) {
    throw new Error('O arquivo selecionado não é um ZIP válido ou está corrompido. Certifique-se de que o arquivo .zip está íntegro.');
  }

  const files: ProjectFile[] = [];
  const allEntries = Object.keys(zip.files);

  if (allEntries.length === 0) {
    throw new Error('O arquivo ZIP está vazio.');
  }

  const isZipSlipEntry = (p: string) => {
    const norm = p.replace(/\\/g, '/');
    return norm.includes('..') || norm.startsWith('/') || /^[a-zA-Z]:/.test(norm);
  };

  // Determine if there is a genuine common root wrapper folder (e.g. from GitHub zipball: "owner-repo-hash/...")
  let commonPrefix = '';
  const relevantEntries = allEntries.filter(
    (e) =>
      !isZipSlipEntry(e) &&
      !e.startsWith('__MACOSX/') &&
      !e.startsWith('__MACOSX') &&
      !e.includes('/._') &&
      !e.startsWith('._')
  );
  if (relevantEntries.length > 0) {
    const sampleEntry = relevantEntries.find((e) => !zip.files[e]?.dir && e.includes('/'));
    if (sampleEntry) {
      const potentialPrefix = sampleEntry.slice(0, sampleEntry.indexOf('/') + 1);
      const allSharePrefix = relevantEntries.every(
        (entry) => entry.startsWith(potentialPrefix) || entry === potentialPrefix.slice(0, -1)
      );
      if (allSharePrefix) {
        commonPrefix = potentialPrefix;
      }
    }
  }

  for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    // Reject Zip Slip directory traversal completely
    if (isZipSlipEntry(rawPath)) continue;

    // Sanitize path
    const safeRawPath = sanitizeFilePath(rawPath);
    if (!safeRawPath) continue;

    // Remove root folder prefix if present
    let relativePath = safeRawPath;
    if (commonPrefix && relativePath.startsWith(commonPrefix)) {
      relativePath = relativePath.slice(commonPrefix.length);
    }

    if (!relativePath || shouldIgnorePath(relativePath)) continue;

    try {
      const content = await zipEntry.async('string');
      // Skip very large single files (> 2MB)
      if (content.length > 2 * 1024 * 1024) continue;

      files.push({
        path: relativePath,
        content,
        size: content.length,
        language: detectLanguage(relativePath),
      });
    } catch {
      // Ignore unreadable individual file
    }
  }

  if (files.length === 0) {
    throw new Error('O arquivo ZIP foi descompactado, mas não contém arquivos de código frontend suportados (.tsx, .jsx, .ts, .js, .vue, .html).');
  }

  return files;
}
