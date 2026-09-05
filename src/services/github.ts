import type { ProjectFile } from '@/types/project';
import { extractZipArchive, shouldIgnorePath, detectLanguage } from './fileSystem';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description?: string;
  stars?: number;
  isPrivate?: boolean;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string;
}

export interface FetchRepoProgress {
  step: 'meta' | 'tree' | 'files' | 'complete';
  message: string;
  current?: number;
  total?: number;
  currentFile?: string;
}

export interface FetchRepoOptions {
  token?: string;
  branch?: string;
  subpath?: string;
  onProgress?: (progress: FetchRepoProgress) => void;
}

export interface GitHubRateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export const POPULAR_GITHUB_REPOS = [
  {
    name: 'Zustand (React State)',
    url: 'pmndrs/zustand',
    description: 'Gerenciamento de estado leve para React com TypeScript',
    tag: 'React',
  },
  {
    name: 'React Router',
    url: 'https://github.com/remix-run/react-router/tree/main/packages/react-router',
    description: 'Rotas declarativas e navegação em React',
    tag: 'Router',
  },
  {
    name: 'Pinia (Vue 3)',
    url: 'https://github.com/vuejs/pinia/tree/v2/packages/pinia',
    description: 'Store oficial e modular para ecossistema Vue 3',
    tag: 'Vue',
  },
  {
    name: 'Preact',
    url: 'preactjs/preact',
    description: 'Biblioteca frontend rápida e compatível com React',
    tag: 'React-like',
  },
] as const;

// Token management in-memory & optional sessionStorage (NEVER localStorage)
const SESSION_TOKEN_KEY = 'cp_gh_session_token';
let inMemoryToken: string | null = null;

export function getGitHubToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (stored) {
        inMemoryToken = stored;
        return stored;
      }
    }
  } catch {
    // sessionStorage not accessible (e.g. sandbox or strict privacy)
  }
  return null;
}

export function setGitHubToken(token: string | null, rememberInSession = false): void {
  const cleaned = token ? token.trim() : null;
  inMemoryToken = cleaned;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (cleaned && rememberInSession) {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, cleaned);
      } else {
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    }
  } catch {
    // ignore
  }
}

export function clearGitHubToken(): void {
  inMemoryToken = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function hasStoredToken(): boolean {
  return Boolean(getGitHubToken());
}

export function isFineGrainedToken(token: string): boolean {
  return token.trim().startsWith('github_pat_');
}

export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Erro desconhecido.';
  return message
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_REDACTED')
    .replace(/github_pat_[a-zA-Z0-9_]+/g, 'github_pat_REDACTED')
    .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_REDACTED')
    .replace(/ghu_[a-zA-Z0-9]{36}/g, 'ghu_REDACTED')
    .replace(/ghs_[a-zA-Z0-9]{36}/g, 'ghs_REDACTED')
    .replace(/ghr_[a-zA-Z0-9]{36}/g, 'ghr_REDACTED')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer REDACTED')
    .replace(/token\s*=\s*[^&\s]+/gi, 'token=REDACTED');
}

export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  if (!input || typeof input !== 'string') return null;

  // 1. Remove surrounding whitespace and git+ prefix
  let cleaned = input.trim().replace(/^git\+/, '');

  // 2. Strip query parameters (?...) and hash fragments (#...)
  cleaned = cleaned.split('?')[0].split('#')[0];

  // 3. Strip trailing .git and trailing slashes
  cleaned = cleaned.replace(/\.git$/, '').replace(/\/+$/, '');

  if (!cleaned) return null;

  // Format 1: owner/repo (e.g. facebook/react or pmndrs/zustand)
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleaned)) {
    const [owner, repo] = cleaned.split('/');
    return { owner, repo };
  }

  // Format 2: SSH git@github.com:owner/repo
  const sshMatch = cleaned.match(/^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  // Format 3: HTTP/HTTPS or protocol-less github.com/owner/repo or tree/blob
  // Supports branches and monorepo subpaths
  const httpMatch = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/
  );
  if (httpMatch) {
    const result: ParsedGitHubUrl = {
      owner: httpMatch[1],
      repo: httpMatch[2],
    };
    if (httpMatch[3]) {
      result.branch = httpMatch[3];
    }
    if (httpMatch[4]) {
      result.subpath = httpMatch[4];
    }
    return result;
  }

  // Format 4: Generic fallback for other github.com URLs
  const genericMatch = cleaned.match(/github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (genericMatch) {
    return { owner: genericMatch[1], repo: genericMatch[2] };
  }

  return null;
}

let cachedRateLimit: { data: GitHubRateLimitInfo; timestamp: number } | null = null;

export async function fetchGitHubRateLimit(token?: string): Promise<GitHubRateLimitInfo | null> {
  const effectiveToken = token || getGitHubToken();
  const now = Date.now();
  if (cachedRateLimit && now - cachedRateLimit.timestamp < 15000) {
    return cachedRateLimit.data;
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  try {
    const res = await fetch('https://api.github.com/rate_limit', { headers });
    if (!res.ok) return null;
    const json = await res.json();
    const core = json.resources?.core;
    if (!core) return null;

    const data: GitHubRateLimitInfo = {
      limit: core.limit,
      remaining: core.remaining,
      reset: new Date(core.reset * 1000),
      used: core.used,
    };
    cachedRateLimit = { data, timestamp: now };
    return data;
  } catch {
    return null;
  }
}

// Concurrency pool helper for parallel file fetching
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let currentIndex = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

function scoreFrontendFile(path: string): number {
  const norm = path.toLowerCase();
  const filename = norm.split('/').pop() || '';

  // 1. Critical project configs & manifests (highest priority for metadata & framework detection)
  if (filename === 'package.json') return 100;
  if (filename === 'tsconfig.json' || filename === 'jsconfig.json') return 95;
  if (filename.includes('vite.config') || filename.includes('next.config') || filename.includes('nuxt.config')) return 90;

  // 2. Core UI source files (pages, components, routes, stores, hooks)
  const isCoreDirectory =
    norm.startsWith('src/') ||
    norm.startsWith('app/') ||
    norm.startsWith('pages/') ||
    norm.includes('/components/') ||
    norm.includes('/views/') ||
    norm.includes('/routes/') ||
    norm.includes('/store/') ||
    norm.includes('/stores/');

  if (isCoreDirectory) {
    if (norm.endsWith('.tsx') || norm.endsWith('.jsx') || norm.endsWith('.vue') || norm.endsWith('.svelte')) {
      return 80;
    }
    if (norm.endsWith('.ts') || norm.endsWith('.js')) {
      return 75;
    }
    return 70;
  }

  // 3. Other component and template files
  if (norm.endsWith('.tsx') || norm.endsWith('.jsx') || norm.endsWith('.vue') || norm.endsWith('.svelte')) {
    return 65;
  }

  // 4. Other typescript/javascript files
  if (norm.endsWith('.ts') || norm.endsWith('.js')) {
    return 55;
  }

  // 5. Test, mock, and documentation files (lowest priority)
  if (
    norm.includes('__tests__') ||
    norm.includes('.test.') ||
    norm.includes('.spec.') ||
    norm.includes('.stories.') ||
    norm.includes('docs/') ||
    norm.includes('examples/') ||
    norm.includes('fixtures/')
  ) {
    return 10;
  }

  return 40;
}

export async function fetchGitHubRepo(
  owner: string,
  repo: string,
  tokenOrOptions?: string | FetchRepoOptions
): Promise<{ info: GitHubRepoInfo; files: ProjectFile[] }> {
  const options: FetchRepoOptions =
    typeof tokenOrOptions === 'string'
      ? { token: tokenOrOptions }
      : tokenOrOptions || {};

  const effectiveToken = options.token || getGitHubToken() || undefined;
  const onProgress = options.onProgress || (() => {});

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (effectiveToken && effectiveToken.trim()) {
    headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
  }

  onProgress({
    step: 'meta',
    message: `Consultando informações de ${owner}/${repo}...`,
  });

  // 1. Fetch repo metadata
  let metaRes: Response;
  try {
    metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  } catch (networkErr: any) {
    throw new Error(
      sanitizeErrorMessage(`Falha de conexão com a API do GitHub: ${networkErr?.message || 'Verifique sua rede.'}`)
    );
  }

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      throw new Error('Token do GitHub inválido ou expirado. Verifique o Personal Access Token informado.');
    }
    if (metaRes.status === 404) {
      throw new Error(
        `Repositório "${owner}/${repo}" não foi encontrado ou é privado. Se for privado, use um Fine-Grained Token com permissão de leitura de conteúdo.`
      );
    }
    if (metaRes.status === 403) {
      const rateLimitRemaining = metaRes.headers.get('x-ratelimit-remaining');
      if (rateLimitRemaining === '0') {
        throw new Error(
          'Limite de requisições anônimas da API do GitHub atingido (60 req/h). Adicione um Fine-Grained Token gratuito para obter até 5.000 req/h.'
        );
      }
      throw new Error('Acesso recusado pelo GitHub (HTTP 403). Verifique suas permissões de repositório.');
    }
    throw new Error(`Erro ao acessar repositório no GitHub (HTTP ${metaRes.status}): ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  const defaultBranch = options.branch || metaData.default_branch || 'main';

  // 2. Fetch Git Tree recursively (1 single fast CORS-friendly request)
  onProgress({
    step: 'tree',
    message: `Buscando arquivos da branch "${defaultBranch}"...`,
  });

  let treeData: any = null;
  try {
    let treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      { headers }
    );
    // If specified branch returned 404 and is different from repo default branch, fallback to default branch
    if (!treeRes.ok && metaData.default_branch && defaultBranch !== metaData.default_branch) {
      const fallbackRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(metaData.default_branch)}?recursive=1`,
        { headers }
      );
      if (fallbackRes.ok) {
        treeRes = fallbackRes;
      }
    }
    if (treeRes.ok) {
      treeData = await treeRes.json();
    }
  } catch {
    // If Git Trees fails, will fall back to zipball
  }

  // 3. Process with Git Trees if available
  if (treeData && Array.isArray(treeData.tree)) {
    const subpathPrefix = options.subpath ? options.subpath.replace(/^\/+|\/+$/g, '') + '/' : '';

    const eligibleItems = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false;
      let path = item.path as string;
      if (subpathPrefix) {
        if (!path.startsWith(subpathPrefix)) return false;
        path = path.slice(subpathPrefix.length);
      }
      if (!path || shouldIgnorePath(path)) return false;
      // Skip very large files (> 1.5MB)
      if (typeof item.size === 'number' && item.size > 1.5 * 1024 * 1024) return false;
      return true;
    });

    if (eligibleItems.length === 0) {
      throw new Error(
        subpathPrefix
          ? `Nenhum arquivo de código frontend suportado foi encontrado na subpasta "${options.subpath}".`
          : 'Nenhum arquivo de código suportado (.tsx, .jsx, .ts, .js, .vue, .html) foi encontrado no repositório.'
      );
    }

    // Sort files by priority: package.json, configs, pages/components first, tests/docs last
    eligibleItems.sort((a: any, b: any) => scoreFrontendFile(b.path) - scoreFrontendFile(a.path));

    // Limit maximum files to 150 to keep processing responsive in the browser
    const filesToFetch = eligibleItems.slice(0, 150);

    let completed = 0;
    let rateLimitHit = false;
    onProgress({
      step: 'files',
      message: `Baixando arquivos frontend (0/${filesToFetch.length})...`,
      current: 0,
      total: filesToFetch.length,
    });

    const files: ProjectFile[] = [];

    await mapConcurrent(filesToFetch, 8, async (item: any) => {
      if (rateLimitHit) return;
      let relativePath = item.path as string;
      if (subpathPrefix && relativePath.startsWith(subpathPrefix)) {
        relativePath = relativePath.slice(subpathPrefix.length);
      }

      try {
        let text = '';
        // For public repos, raw.githubusercontent is fast, CORS-friendly & avoids burning API rate limits
        if (!metaData.private) {
          const encodedPath = item.path.split('/').map(encodeURIComponent).join('/');
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(defaultBranch)}/${encodedPath}`;
          const rawRes = await fetch(rawUrl);
          if (rawRes.ok) {
            text = await rawRes.text();
          }
        }

        // Fallback or authenticated fetch via Git blob API (CORS enabled)
        if (!text && item.url) {
          const blobRes = await fetch(item.url, {
            headers: {
              ...headers,
              Accept: 'application/vnd.github.raw',
            },
          });
          if (blobRes.ok) {
            text = await blobRes.text();
          } else if (blobRes.status === 403) {
            const remaining = blobRes.headers.get('x-ratelimit-remaining');
            if (remaining === '0') {
              rateLimitHit = true;
            }
          }
        }

        if (text) {
          files.push({
            path: relativePath,
            content: text,
            size: text.length,
            language: detectLanguage(relativePath),
          });
        }
      } catch {
        // Ignore individual file fetch failure
      } finally {
        completed++;
        onProgress({
          step: 'files',
          message: `Baixando arquivos frontend (${completed}/${filesToFetch.length})...`,
          current: completed,
          total: filesToFetch.length,
          currentFile: relativePath,
        });
      }
    });

    if (rateLimitHit && files.length === 0) {
      throw new Error(
        'Limite de requisições anônimas da API do GitHub atingido (60 req/h). Adicione um Fine-Grained Token gratuito para obter até 5.000 req/h.'
      );
    }

    if (files.length > 0) {
      onProgress({
        step: 'complete',
        message: `${files.length} arquivos carregados com sucesso!`,
        current: files.length,
        total: files.length,
      });

      return {
        info: {
          owner,
          repo,
          defaultBranch,
          description: metaData.description,
          stars: metaData.stargazers_count,
          isPrivate: Boolean(metaData.private),
        },
        files,
      };
    }

    throw new Error(
      'Não foi possível obter o conteúdo dos arquivos do repositório. Verifique sua conexão ou forneça um token de acesso.'
    );
  }

  // 4. Fallback: Fetch repo ZIP archive (useful in Node environment or if Git Tree was empty/truncated)
  onProgress({
    step: 'files',
    message: `Baixando pacote compactado (ZIP) da branch "${defaultBranch}"...`,
  });

  let zipRes: Response;
  try {
    zipRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`, {
      headers: {
        ...headers,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
  } catch (networkErr: any) {
    throw new Error(
      sanitizeErrorMessage(
        `Falha ao baixar o arquivo ZIP da branch "${defaultBranch}": ${networkErr?.message || 'Erro de rede.'}`
      )
    );
  }

  if (!zipRes.ok) {
    throw new Error(
      `Não foi possível baixar o código da branch principal "${defaultBranch}" (HTTP ${zipRes.status}).`
    );
  }

  const zipBuffer = await zipRes.arrayBuffer();
  const files = await extractZipArchive(zipBuffer);

  return {
    info: {
      owner,
      repo,
      defaultBranch,
      description: metaData.description,
      stars: metaData.stargazers_count,
      isPrivate: Boolean(metaData.private),
    },
    files,
  };
}
