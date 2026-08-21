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

