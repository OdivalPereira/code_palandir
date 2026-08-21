import { getSessionAccessToken } from './authClient';
import { getCachedHttpResponse, setCachedHttpResponse } from './cacheRepository';
import { requestResponse } from './api/client';

const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';
const GITHUB_PAT_STORAGE_KEY = 'codemind:github_pat';

let memoryPat: string | null = null;

export const getGitHubPat = (): string | null => {
  if (memoryPat) return memoryPat;
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(GITHUB_PAT_STORAGE_KEY) || null;
  }
  return null;
};

export const setGitHubPat = (pat: string): void => {
  memoryPat = pat.trim();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GITHUB_PAT_STORAGE_KEY, memoryPat);
  }
};

export const clearGitHubPat = (): void => {
  memoryPat = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(GITHUB_PAT_STORAGE_KEY);
  }
};

export const fetchGitHubJson = async <T>(url: string): Promise<T> => {
  const cachedResponse = await getCachedHttpResponse(url);
  const pat = getGitHubPat();
  const sessionToken = await getSessionAccessToken();
  const token = pat || sessionToken;

  const headers: HeadersInit = {
    Accept: GITHUB_ACCEPT_HEADER,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (cachedResponse?.etag) {
    headers['If-None-Match'] = cachedResponse.etag;
  }

  let response: Response;
  try {
    response = await requestResponse(url, { headers }, { allowedStatuses: [304], credentials: 'omit' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.';
    throw new Error(`GitHub request failed for ${url}. ${message}`);
  }

  if (response.status === 304) {
    if (cachedResponse?.data) {
      return cachedResponse.data as T;
    }
    throw new Error(`GitHub returned 304 for ${url} without cached data.`);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(`GitHub Unauthorized (401). Please verify your GitHub Personal Access Token (PAT).`);
    }
    if (response.status === 403) {
      throw new Error(`GitHub Rate Limit Exceeded or Forbidden (403). Configure a GitHub PAT in the top bar to analyze private repos and increase API limits.`);
    }
    if (response.status === 404) {
      throw new Error(`GitHub Resource Not Found (404). If this is a private repository, please configure a GitHub PAT with 'repo' scope.`);
    }
    throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
  }

  const data = (await response.json()) as T;
  const etag = response.headers.get('ETag');
  await setCachedHttpResponse(url, data, etag);

  return data;
};

/**
 * Fetches file content from a repository (public or private).
 * Uses API contents endpoint when PAT is available for private repos,
 * or raw.githubusercontent.com for fast public access.
 */
export const fetchGitHubFileContent = async (
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string> => {
  const pat = getGitHubPat();
  const sessionToken = await getSessionAccessToken();
  const token = pat || sessionToken;

  // Try fetching via API with authentication if token exists
  if (token) {
    try {
      const data = await fetchGitHubJson<{ content?: string; encoding?: string }>(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`
      );
      if (data.content) {
        if (data.encoding === 'base64' || !data.encoding) {
          return decodeURIComponent(
            escape(atob(data.content.replace(/\s/g, '')))
          );
        }
        return data.content;
      }
    } catch (apiErr) {
      console.warn(`API fetch failed for ${filePath}, falling back to raw:`, apiErr);
    }
  }

  // Fallback to raw endpoint
  const rawHeaders: HeadersInit = {};
  if (token) {
    rawHeaders.Authorization = `token ${token}`;
  }
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  const response = await fetch(rawUrl, { headers: rawHeaders });
  if (!response.ok) {
    throw new Error(`Failed to fetch file content (${response.status}): ${filePath}`);
  }
  return await response.text();
};

/**
 * Generic authenticated API mutation helper (POST, PUT, DELETE)
 */
export const sendGitHubMutation = async <T>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T> => {
  const pat = getGitHubPat();
  const sessionToken = await getSessionAccessToken();
  const token = pat || sessionToken;

  if (!token) {
    throw new Error('Authentication required for this GitHub operation. Please configure a GitHub PAT or log in.');
  }

  const headers: HeadersInit = {
    Accept: GITHUB_ACCEPT_HEADER,
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const message = (errBody as any).message || response.statusText;
    throw new Error(`GitHub API error (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

/**
 * List branches for a repository.
 */
export const listRepoBranches = async (owner: string, repo: string): Promise<import('./types').GitHubBranch[]> => {
  return fetchGitHubJson<import('./types').GitHubBranch[]>(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`
  );
};

/**
 * List tags for a repository.
 */
export const listRepoTags = async (owner: string, repo: string): Promise<import('./types').GitHubTag[]> => {
  return fetchGitHubJson<import('./types').GitHubTag[]>(
    `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`
  );
};

/**
 * List pull requests for a repository.
 */
export const listRepoPullRequests = async (
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<import('./types').GitHubPullRequest[]> => {
  return fetchGitHubJson<import('./types').GitHubPullRequest[]>(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`
  );
};

/**
 * Get files changed in a specific pull request with diff stats and patches.
 */
export const getPullRequestFiles = async (
  owner: string,
  repo: string,
  pullNumber: number
): Promise<import('./types').GitHubPullRequestFile[]> => {
  return fetchGitHubJson<import('./types').GitHubPullRequestFile[]>(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`
  );
};

/**
 * List recent commits for a repository / branch.
 */
export const listRepoCommits = async (
  owner: string,
  repo: string,
  branch?: string,
  perPage: number = 20
): Promise<import('./types').GitHubCommitItem[]> => {
  const branchParam = branch ? `&sha=${encodeURIComponent(branch)}` : '';
  return fetchGitHubJson<import('./types').GitHubCommitItem[]>(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}${branchParam}`
  );
};

/**
 * Get current rate limit status for GitHub API.
 */
export const getRateLimitStatus = async (): Promise<import('./types').GitHubRateLimit> => {
  const data = await fetchGitHubJson<{ resources: { core: import('./types').GitHubRateLimit } }>(
    'https://api.github.com/rate_limit'
  );
  return data.resources.core;
};

/**
 * Creates a new branch from a base branch, commits one or more files, and opens a Pull Request.
 */
export const createBranchAndOpenPr = async (
  owner: string,
  repo: string,
  baseBranch: string,
  payload: import('./types').CreatePrPayload
): Promise<import('./types').GitHubPullRequest> => {
  const { branchName, commitMessage, prTitle, prBody, files } = payload;

  // 1. Get base branch latest commit SHA
  const refData = await fetchGitHubJson<{ object: { sha: string } }>(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`
  );
  const baseSha = refData.object.sha;

  // 2. Create the new branch reference
  await sendGitHubMutation(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    'POST',
    {
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }
  );

  // 3. Commit files (via content API or sequential commits)
  for (const file of files) {
    // Check if file already exists on the new branch to get its sha
    let existingSha: string | undefined;
    try {
      const existing = await fetchGitHubJson<{ sha: string }>(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branchName}`
      );
      existingSha = existing.sha;
    } catch {
      // File does not exist yet (creating new)
    }

    const utf8Bytes = new TextEncoder().encode(file.content);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binary);

    await sendGitHubMutation(
      `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
      'PUT',
      {
        message: commitMessage,
        content: base64Content,
        branch: branchName,
        sha: existingSha,
      }
    );
  }

  // 4. Create Pull Request
  const pr = await sendGitHubMutation<import('./types').GitHubPullRequest>(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    'POST',
    {
      title: prTitle,
      body: prBody || `Automated refactoring / code suggestion generated by **Code Palandir AI**.`,
      head: branchName,
      base: baseBranch,
    }
  );

  return pr;
};


