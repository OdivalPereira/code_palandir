import { getCachedHttpResponse, setCachedHttpResponse } from './cacheRepository';

const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';

export const fetchGitHubJson = async <T>(url: string): Promise<T> => {
  const cachedResponse = await getCachedHttpResponse(url);

  const headers: HeadersInit = {
    Accept: GITHUB_ACCEPT_HEADER,
  };

  if (cachedResponse?.etag) {
    headers['If-None-Match'] = cachedResponse.etag;
  }

  const response = await fetch(url, { headers });

  if (response.status === 304) {
    if (cachedResponse?.data) {
      return cachedResponse.data as T;
    }
    throw new Error(`GitHub returned 304 for ${url} without cached data.`);
  }

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${url}.`);
  }

  const data = (await response.json()) as T;
  const etag = response.headers.get('ETag');
  await setCachedHttpResponse(url, data, etag);

  return data;
};
