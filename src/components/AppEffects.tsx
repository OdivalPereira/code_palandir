import React, { useEffect, useRef } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { usePresenceStore } from '../stores/presenceStore';
import { selectIsPromptOpen, selectProjectSignature, selectSelectedNode, selectSessionId, selectSidebarTab } from '../stores/graphSelectors';
import { createRealtimeClient } from '../realtimeClient';

const AppEffects: React.FC = () => {
  const selectedNode = useGraphStore(selectSelectedNode);
  const analyzeSelectedFile = useGraphStore((state) => state.analyzeSelectedFile);
  const isPromptOpen = useGraphStore(selectIsPromptOpen);
  const sidebarTab = useGraphStore(selectSidebarTab);
  const refreshAiMetrics = useGraphStore((state) => state.refreshAiMetrics);
  const sessionId = useGraphStore(selectSessionId);
  const projectSignature = useGraphStore(selectProjectSignature);

  const presenceClientId = usePresenceStore((state) => state.clientId);
  const presenceProfile = usePresenceStore((state) => state.profile);
  const localCursor = usePresenceStore((state) => state.localCursor);
  const localSelection = usePresenceStore((state) => state.localSelection);
  const setLocalSelection = usePresenceStore((state) => state.setLocalSelection);
  const setPeers = usePresenceStore((state) => state.setPeers);
  const updatePeer = usePresenceStore((state) => state.updatePeer);
  const removePeer = usePresenceStore((state) => state.removePeer);
  const setConnectionStatus = usePresenceStore((state) => state.setConnectionStatus);

  const realtimeClientRef = useRef<ReturnType<typeof createRealtimeClient> | null>(null);
  const realtimeSessionId = sessionId ?? projectSignature ?? null;

  useEffect(() => {
    setLocalSelection(selectedNode?.id ?? null);
  }, [selectedNode, setLocalSelection]);

  useEffect(() => {
    analyzeSelectedFile(selectedNode);
  }, [analyzeSelectedFile, selectedNode]);

  useEffect(() => {
    if (!isPromptOpen || sidebarTab !== 'metrics') return;
    refreshAiMetrics();
  }, [isPromptOpen, sidebarTab, refreshAiMetrics]);

  useEffect(() => {
    if (!realtimeSessionId) {
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      return;
    }

    realtimeClientRef.current?.close();
    try {
      realtimeClientRef.current = createRealtimeClient({
        sessionId: realtimeSessionId,
        clientId: presenceClientId,
        profile: presenceProfile,
        onStateSync: (presence) => {
          const peers = presence.filter((entry) => entry.clientId !== presenceClientId);
          setPeers(peers);
        },
        onPresenceUpdate: (presence) => {
          if (presence.clientId === presenceClientId) return;
          updatePeer(presence);
        },
        onPresenceRemove: (clientId) => {
          if (clientId === presenceClientId) return;
          removePeer(clientId);
        },
        onConnectionChange: (status) => {
          setConnectionStatus(status);
        }
      });
    } catch (error) {
      console.error('Failed to create realtime client', error);
      setConnectionStatus('disconnected');
    }

    return () => {
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
    };
  }, [presenceClientId, presenceProfile, realtimeSessionId, removePeer, setConnectionStatus, setPeers, updatePeer]);

  useEffect(() => {
    if (!realtimeSessionId || !realtimeClientRef.current) return;
    realtimeClientRef.current.sendPresenceUpdate({
      cursor: localCursor,
      selection: localSelection
    });
  }, [localCursor, localSelection, realtimeSessionId]);

  return null;
};

export default AppEffects;
