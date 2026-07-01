// The access token lives in memory only — never persisted to storage.
// Lost on page reload; the 401 interceptor in api.ts re-acquires it via /auth/refresh.
// The refresh token is a backend-managed HttpOnly cookie and is never stored here.
let accessToken: string | null = null;

export const tokenStorage = {
  getAccess: () => accessToken,
  set: (access: string) => {
    accessToken = access;
  },
  clear: () => {
    accessToken = null;
  },
};
