import { create } from './zustand';
import { PresenceCursor, PresenceProfile, PresenceSelection, PresenceState } from '../types';

const COLORS = ['#22d3ee', '#f97316', '#a855f7', '#10b981', '#eab308', '#f43f5e', '#38bdf8'];
const NAMES = ['Orquídea', 'Saíra', 'Tucano', 'Lobo', 'Arara', 'Boto', 'Sabiá', 'Iara', 'Jaci', 'Guará'];

const buildClientId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `client-${Math.random().toString(36).slice(2, 10)}`;
};

const buildProfile = (): PresenceProfile => {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { name, color };
};

type PresenceStore = {
  clientId: string;
  profile: PresenceProfile;
  localCursor: PresenceCursor | null;
  localSelection: PresenceSelection;
  peers: Record<string, PresenceState>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  setLocalCursor: (cursor: PresenceCursor | null) => void;
  setLocalSelection: (selectedNodeId: string | null) => void;
  setPeers: (peers: PresenceState[]) => void;
  updatePeer: (peer: PresenceState) => void;
  removePeer: (clientId: string) => void;
  setConnectionStatus: (status: PresenceStore['connectionStatus']) => void;
};

const initialProfile = buildProfile();
const initialClientId = buildClientId();

export const usePresenceStore = create<PresenceStore>((set) => ({
  clientId: initialClientId,
  profile: initialProfile,
  localCursor: null,
  localSelection: { selectedNodeId: null },
  peers: {},
  connectionStatus: 'disconnected',
  setLocalCursor: (cursor) => set({ localCursor: cursor }),
  setLocalSelection: (selectedNodeId) => set({ localSelection: { selectedNodeId } }),
  setPeers: (peers) => set({
    peers: peers.reduce<Record<string, PresenceState>>((acc, peer) => {
      acc[peer.clientId] = peer;
      return acc;
    }, {})
  }),
  updatePeer: (peer) => set((state) => ({
    peers: { ...state.peers, [peer.clientId]: peer }
  })),
  removePeer: (clientId) => set((state) => {
    if (!state.peers[clientId]) return state;
    const next = { ...state.peers };
    delete next[clientId];
    return { peers: next };
  }),
  setConnectionStatus: (status) => set({ connectionStatus: status })
}));
