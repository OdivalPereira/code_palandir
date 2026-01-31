let cachedAccessToken: string | null | undefined;
let pendingAccessTokenRequest: Promise<string | null> | null = null;

export const getSessionAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken !== undefined) {
    return cachedAccessToken;
  }

  if (pendingAccessTokenRequest) {
    return pendingAccessTokenRequest;
  }

  pendingAccessTokenRequest = fetch('/api/session', { credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as { accessToken?: string | null };
      cachedAccessToken = data.accessToken ?? null;
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
