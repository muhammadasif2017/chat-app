'use client';

import { usePresenceStore } from '../store/presence.store';

export function usePresence() {
  return usePresenceStore((s) => s.presence);
}
