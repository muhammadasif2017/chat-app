'use client';

import { create } from 'zustand';

interface ToastState {
  message: string | null;
  lastShownAt: number;
  show: (message: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  lastShownAt: 0,
  show: (message) => set({ message, lastShownAt: Date.now() }),
  clear: () => set({ message: null }),
}));
