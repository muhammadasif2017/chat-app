import { create } from 'zustand';

interface PresenceState {
  presence: Record<string, boolean>;
  setRoster: (roster: Record<string, boolean>) => void;
  setOnline: (userId: string) => void;
  setOffline: (userId: string) => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  presence: {},
  setRoster: (roster) => set({ presence: roster }),
  setOnline: (userId) => set((s) => ({ presence: { ...s.presence, [userId]: true } })),
  setOffline: (userId) => set((s) => ({ presence: { ...s.presence, [userId]: false } })),
}));
