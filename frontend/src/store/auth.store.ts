'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `ca_authed=1; path=/; max-age=604800; SameSite=Lax${secure}`;
        set({ user, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        document.cookie = 'ca_authed=; path=/; max-age=0';
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'ca-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
