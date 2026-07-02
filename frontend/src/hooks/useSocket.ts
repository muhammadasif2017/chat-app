'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { refreshAccessToken } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useToastStore } from '../store/toast.store';

export function useSocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasDisconnected = useRef(false);
  const connectErrorShown = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    connectSocket();
    const socket = getSocket();

    // The gateway calls socket.disconnect() when the access token is missing/expired
    // (on connect and on every event). That reason skips socket.io's built-in
    // auto-reconnect, so we refresh the token ourselves and reconnect manually.
    const onDisconnect = (reason: string) => {
      wasDisconnected.current = true;
      if (reason === 'io server disconnect') {
        refreshAccessToken().catch(() => {});
      }
    };

    // Resync after any real reconnect (automatic or our manual one above) — events
    // emitted while we were offline (new messages, reactions, etc.) were missed.
    const onConnect = () => {
      connectErrorShown.current = false;
      if (!wasDisconnected.current) return;
      wasDisconnected.current = false;
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages'] });
    };

    // The gateway emits 'error' for rejected actions (rate limit, not a member,
    // session expired, validation) — surface it instead of failing silently.
    const onError = ({ message }: { message: string | string[] }) => {
      useToastStore.getState().show(Array.isArray(message) ? message.join(', ') : message);
    };

    // Fires repeatedly during the reconnection backoff loop when the server is
    // unreachable (not an auth rejection — that completes the handshake first).
    // Show it once per outage instead of once per retry attempt.
    const onConnectError = () => {
      if (connectErrorShown.current) return;
      connectErrorShown.current = true;
      useToastStore.getState().show('Unable to reach the server. Retrying…');
    };

    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.on('error', onError);
    socket.on('connect_error', onConnectError);

    intervalRef.current = setInterval(() => {
      getSocket()?.emit('ping');
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.off('error', onError);
      socket.off('connect_error', onConnectError);
      disconnectSocket();
    };
  }, [isAuthenticated, qc]);
}
