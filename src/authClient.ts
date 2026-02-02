import { fetchSessionAccessToken } from './api/client';

let cachedAccessToken: string | null | undefined;
let pendingAccessTokenRequest: Promise<string | null> | null = null;

export const getSessionAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken !== undefined) {
    return cachedAccessToken;
  }

  if (pendingAccessTokenRequest) {
    return pendingAccessTokenRequest;
  }

  pendingAccessTokenRequest = fetchSessionAccessToken()
    .then((accessToken) => {
      cachedAccessToken = accessToken ?? null;
      return cachedAccessToken;
    })
    .catch(() => {
      cachedAccessToken = null;
      return cachedAccessToken;
    })
    .finally(() => {
      pendingAccessTokenRequest = null;
    });

  return pendingAccessTokenRequest;
};

export const clearSessionAccessToken = () => {
  cachedAccessToken = null;
};
