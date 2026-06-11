'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';

export function useSocket(): Socket | null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    connectSocket();
    socketRef.current = getSocket();

    const interval = setInterval(() => {
      socketRef.current?.emit('ping');
    }, 15000);

    return () => {
      clearInterval(interval);
      disconnectSocket();
    };
  }, [isAuthenticated]);

  return socketRef.current;
}
