'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import api, { refreshAccessToken } from '../lib/api';
import { tokenStorage } from '../lib/auth';
import type { User } from '../types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    // On a fresh page load the access token only lives in memory (ADR-009) and is
    // wiped by reload, so this would otherwise always 401 once and rely on the
    // response interceptor's retry — which also delays connectSocket() (called from
    // refreshAccessToken) since nothing else refreshes on mount. Refresh up front instead.
    // refreshAccessToken() already logs out + redirects on failure, so a rejection
    // here just means "stop": no /users/me is needed.
    const initial = tokenStorage.getAccess()
      ? Promise.resolve(true)
      : refreshAccessToken().then(
          () => true,
          () => false,
        );
    initial
      .then((ok) => (ok ? api.get<User>('/users/me') : null))
      .then((res) => res && setUser(res.data))
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
