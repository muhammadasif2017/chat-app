/* @jest-environment jsdom */
import { render } from '@testing-library/react';

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../lib/auth', () => ({
  tokenStorage: { getAccess: jest.fn(), set: jest.fn(), clear: jest.fn() },
}));

jest.mock('../../store/auth.store', () => ({
  useAuthStore: jest.fn(),
}));

import api, { refreshAccessToken } from '../../lib/api';
import { tokenStorage } from '../../lib/auth';
import { useAuthStore } from '../../store/auth.store';
import { AuthProvider } from '../auth-provider';

const mockGet = api.get as jest.Mock;
const mockRefresh = refreshAccessToken as jest.Mock;
const mockGetAccess = tokenStorage.getAccess as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

async function flush() {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
  }
}

describe('AuthProvider', () => {
  const setUser = jest.fn();
  const logout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({ isAuthenticated: true, setUser, logout });
    mockGet.mockResolvedValue({ data: { id: 'u1', username: 'alice' } });
  });

  it('refreshes the access token before calling /users/me when no token is in memory yet', async () => {
    mockGetAccess.mockReturnValue(null);
    mockRefresh.mockResolvedValue('fresh-token');

    render(<AuthProvider>{null}</AuthProvider>);
    await flush();

    expect(mockRefresh).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(setUser).toHaveBeenCalledWith({ id: 'u1', username: 'alice' });
  });

  it('skips the refresh and calls /users/me directly when a token is already in memory', async () => {
    mockGetAccess.mockReturnValue('existing-token');

    render(<AuthProvider>{null}</AuthProvider>);
    await flush();

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(setUser).toHaveBeenCalledWith({ id: 'u1', username: 'alice' });
  });

  it('does not call /users/me when the initial refresh fails', async () => {
    mockGetAccess.mockReturnValue(null);
    mockRefresh.mockRejectedValue(new Error('refresh failed'));

    render(<AuthProvider>{null}</AuthProvider>);
    await flush();

    expect(mockRefresh).toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
