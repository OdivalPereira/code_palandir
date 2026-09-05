import type { ProjectFile } from '@/types/project';
import { extractZipArchive } from './fileSystem';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description?: string;
  stars?: number;
}

export function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/^git\+/, '').replace(/\.git$/, '').replace(/\/+$/, '');
  
  // Format: owner/repo
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    const [owner, repo] = trimmed.split('/');
    return { owner, repo };
  }

  // Format: https://github.com/owner/repo or git@github.com:owner/repo
  const match = trimmed.match(/github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  return null;
}

export async function fetchGitHubRepo(
  owner: string,
  repo: string,
  token?: string
): Promise<{ info: GitHubRepoInfo; files: ProjectFile[] }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  // 1. Fetch repo metadata
  let metaRes: Response;
  try {
    metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  } catch (networkErr: any) {
    throw new Error(`Falha de conexão com a API do GitHub: ${networkErr?.message || 'Verifique sua conexão de rede.'}`);
  }

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      throw new Error('Token do GitHub inválido ou sem permissão. Verifique o Personal Access Token informado.');
    }
    if (metaRes.status === 404) {
      throw new Error(`Repositório "${owner}/${repo}" não foi encontrado ou é privado. Se for privado, informe um Personal Access Token com permissão de leitura.`);
    }
    if (metaRes.status === 403) {
      const rateLimitRemaining = metaRes.headers.get('x-ratelimit-remaining');
      if (rateLimitRemaining === '0') {
        throw new Error('Limite de requisições anônimas da API do GitHub atingido (60 req/h). Adicione um Personal Access Token para obter até 5.000 req/h.');
      }
      throw new Error('Acesso recusado pelo GitHub (HTTP 403). Verifique suas permissões ou token.');
    }
    throw new Error(`Erro ao acessar repositório no GitHub (HTTP ${metaRes.status}): ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  const defaultBranch = metaData.default_branch || 'main';

  // 2. Fetch repo ZIP archive
  let zipRes: Response;
  try {
    zipRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`, {
      headers: {
        ...headers,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
  } catch (networkErr: any) {
    throw new Error(`Falha ao baixar o arquivo ZIP da branch "${defaultBranch}": ${networkErr?.message || 'Erro de rede.'}`);
  }

  if (!zipRes.ok) {
    throw new Error(`Não foi possível baixar o código da branch principal "${defaultBranch}" (HTTP ${zipRes.status}).`);
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
    },
    files,
  };
}
