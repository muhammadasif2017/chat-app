'use client';

import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/auth.store';
import { usePresenceStore } from '../store/presence.store';

export function usePresenceSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    const { setRoster, setOnline, setOffline } = usePresenceStore.getState();

    const onRoster = (roster: Record<string, boolean>) => setRoster(roster);
    const onOnline = ({ userId }: { userId: string }) => setOnline(userId);
    const onOffline = ({ userId }: { userId: string }) => setOffline(userId);

    socket.on('presence_roster', onRoster);
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);

    return () => {
      socket.off('presence_roster', onRoster);
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [isAuthenticated]);
}
