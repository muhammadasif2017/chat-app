// The access token lives in localStorage and is sent as a Bearer token.
// The refresh token is a backend-managed HttpOnly cookie and is never stored here.
const ACCESS_KEY = 'ca_access';

export const tokenStorage = {
  getAccess: () => (typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null),
  set: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => localStorage.removeItem(ACCESS_KEY),
};
