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
      .catch((err: unknown) => {
        const status =
          err != null &&
          typeof err === 'object' &&
          'response' in err &&
          err.response != null &&
          typeof err.response === 'object' &&
          'status' in err.response
            ? (err.response as { status: number }).status
            : null;
        if (status === 401) {
          api
            .post('/auth/logout')
            .catch(() => {})
            .finally(() => logout());
        }
      });
  }, [isAuthenticated, setUser, logout]);

  return <>{children}</>;
}
