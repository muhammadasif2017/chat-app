'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';

export type SocketStatus = 'connected' | 'disconnected' | 'connecting';

export function useSocketStatus(): SocketStatus {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>(() =>
    getSocket().connected ? 'connected' : 'connecting',
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();
    const onConnect = () => setSocketStatus('connected');
    const onDisconnect = () => setSocketStatus('disconnected');
    const onReconnectAttempt = () => setSocketStatus('connecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return 'disconnected';
  return socketStatus;
}
