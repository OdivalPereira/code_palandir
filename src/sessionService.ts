import { SessionPayload } from './types';

type SaveSessionResponse = {
  sessionId: string;
  session: SessionPayload;
};

type OpenSessionResponse = {
  sessionId: string;
  session: SessionPayload;
};

export const saveSession = async (
  session: SessionPayload,
  sessionId?: string | null
): Promise<SaveSessionResponse> => {
  const response = await fetch('/api/sessions/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      sessionId: sessionId ?? undefined,
      session
    })
  });

  if (!response.ok) {
    throw new Error('Failed to save session.');
  }

  return response.json();
};

export const openSession = async (sessionId: string): Promise<OpenSessionResponse> => {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to open session.');
  }

  return response.json();
};
