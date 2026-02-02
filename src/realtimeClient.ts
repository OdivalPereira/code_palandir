import { PresenceProfile, PresenceSelection, PresenceState, PresenceCursor } from './types';

type PresencePayload = {
  cursor: PresenceCursor | null;
  selection: PresenceSelection;
};

type JoinMessage = {
  type: 'join';
  sessionId: string;
  clientId: string;
  profile: PresenceProfile;
};

type PresenceUpdateMessage = {
  type: 'presence_update';
  sessionId: string;
  clientId: string;
  presence: PresencePayload;
  sequence: number;
  timestamp: number;
};

type PresenceRemoveMessage = {
  type: 'presence_remove';
  clientId: string;
};

type StateSyncMessage = {
  type: 'state_sync';
  sessionId: string;
  presence: PresenceState[];
};

type IncomingMessage = StateSyncMessage | { type: 'presence_update'; presence: PresenceState } | PresenceRemoveMessage;

type RealtimeClientOptions = {
  sessionId: string;
  clientId: string;
  profile: PresenceProfile;
  onStateSync: (presence: PresenceState[]) => void;
  onPresenceUpdate: (presence: PresenceState) => void;
  onPresenceRemove: (clientId: string) => void;
  onConnectionChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
};

const buildRealtimeUrl = () => {
  if (typeof window === 'undefined') return '';
  const baseUrl = import.meta.env.VITE_REALTIME_URL ?? window.location.origin;
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/realtime';
  return url.toString();
};

export const createRealtimeClient = (options: RealtimeClientOptions) => {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let sequence = 0;
  let isClosed = false;

  const sendMessage = (message: JoinMessage | PresenceUpdateMessage) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  };

  const connect = () => {
    if (isClosed) return;
    options.onConnectionChange('connecting');
    socket = new WebSocket(buildRealtimeUrl());

    socket.addEventListener('open', () => {
      options.onConnectionChange('connected');
      sendMessage({
        type: 'join',
        sessionId: options.sessionId,
        clientId: options.clientId,
        profile: options.profile
      });
    });

    socket.addEventListener('message', (event) => {
      try {
        const parsed = JSON.parse(event.data) as IncomingMessage;
        if (parsed.type === 'state_sync') {
          options.onStateSync(parsed.presence ?? []);
        } else if (parsed.type === 'presence_update') {
          options.onPresenceUpdate(parsed.presence);
        } else if (parsed.type === 'presence_remove') {
          options.onPresenceRemove(parsed.clientId);
        }
      } catch (error) {
        console.error('Invalid realtime payload', error);
      }
    });

    socket.addEventListener('close', () => {
      options.onConnectionChange('disconnected');
      if (isClosed) return;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(connect, 1500);
    });

    socket.addEventListener('error', () => {
      options.onConnectionChange('disconnected');
    });
  };

  connect();

  return {
    sendPresenceUpdate: (presence: PresencePayload) => {
      sequence += 1;
      sendMessage({
        type: 'presence_update',
        sessionId: options.sessionId,
        clientId: options.clientId,
        presence,
        sequence,
        timestamp: Date.now()
      });
    },
    close: () => {
      isClosed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socket = null;
    }
  };
};
