import { getSessionAccessToken } from './authClient';
import { getCachedHttpResponse, setCachedHttpResponse } from './cacheRepository';
import { requestResponse } from './api/client';

const GITHUB_ACCEPT_HEADER = 'application/vnd.github+json';

export const fetchGitHubJson = async <T>(url: string): Promise<T> => {
  const cachedResponse = await getCachedHttpResponse(url);
  const accessToken = await getSessionAccessToken();

  const headers: HeadersInit = {
    Accept: GITHUB_ACCEPT_HEADER,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
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

  const data = (await response.json()) as T;
  const etag = response.headers.get('ETag');
  await setCachedHttpResponse(url, data, etag);

  return data;
};
