import { openSession as openSessionApi, saveSession as saveSessionApi } from './api/client';
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
): Promise<SaveSessionResponse> => saveSessionApi(session, sessionId);

export const openSession = async (sessionId: string): Promise<OpenSessionResponse> =>
  openSessionApi(sessionId);
