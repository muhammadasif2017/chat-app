'use client';

import { useEffect, useRef } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';

export function useSocket(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    connectSocket();

    intervalRef.current = setInterval(() => {
      getSocket()?.emit('ping');
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      disconnectSocket();
    };
  }, [isAuthenticated]);
}
