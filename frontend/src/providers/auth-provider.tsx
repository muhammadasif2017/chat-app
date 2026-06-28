'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import api from '../lib/api';
import type { User } from '../types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get<User>('/users/me')
      .then((res) => setUser(res.data))
      .catch(() =>
        api
          .post('/auth/logout')
          .catch(() => {})
          .finally(() => logout()),
      );
  }, [isAuthenticated, setUser, logout]);

  return <>{children}</>;
}
