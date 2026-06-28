'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';

export function usePresence() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [presence, setPresence] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();

    const onRoster = (roster: Record<string, boolean>) => {
      setPresence(new Map(Object.entries(roster)));
    };
    const onOnline = ({ userId }: { userId: string }) => {
      setPresence((prev) => new Map(prev).set(userId, true));
    };
    const onOffline = ({ userId }: { userId: string }) => {
      setPresence((prev) => new Map(prev).set(userId, false));
    };

    socket.on('presence_roster', onRoster);
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);

    return () => {
      socket.off('presence_roster', onRoster);
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [isAuthenticated]);

  return presence;
}
