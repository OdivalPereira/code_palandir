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
  const trimmed = input.trim();
  // Format: owner/repo
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    const [owner, repo] = trimmed.split('/');
    return { owner, repo };
  }

  // Format: https://github.com/owner/repo or git@github.com:owner/repo
  const match = trimmed.match(/github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/|$)/);
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
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  // 1. Fetch repo metadata
  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!metaRes.ok) {
    if (metaRes.status === 404) throw new Error(`Repositório "${owner}/${repo}" não encontrado ou é privado.`);
    if (metaRes.status === 403) throw new Error('Limite de requisições do GitHub atingido. Adicione um Personal Access Token.');
    throw new Error(`Erro ao acessar GitHub: ${metaRes.statusText}`);
  }

  const metaData = await metaRes.json();
  const defaultBranch = metaData.default_branch || 'main';

  // 2. Fetch repo ZIP archive
  const zipRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`, {
    headers: {
      ...headers,
      Accept: 'application/vnd.github.v3.raw',
    },
  });

  if (!zipRes.ok) {
    throw new Error(`Não foi possível baixar o código da branch ${defaultBranch}.`);
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
