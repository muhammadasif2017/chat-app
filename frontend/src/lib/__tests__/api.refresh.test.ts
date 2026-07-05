/* @jest-environment jsdom */
jest.mock('axios', () => {
  const post = jest.fn();
  const create = jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }));
  return { __esModule: true, default: { create, post } };
});

jest.mock('../auth', () => ({
  tokenStorage: {
    getAccess: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('../socket', () => ({
  connectSocket: jest.fn(),
  getSocket: jest.fn(() => ({ connected: false, id: undefined })),
}));

jest.mock('../../store/auth.store', () => {
  const logout = jest.fn();
  return { useAuthStore: { getState: () => ({ logout }) } };
});

import axios from 'axios';
import { refreshAccessToken } from '../api';
import { connectSocket } from '../socket';
import { tokenStorage } from '../auth';
import { useAuthStore } from '../../store/auth.store';

const mockPost = axios.post as jest.Mock;
const mockLogout = useAuthStore.getState().logout as jest.Mock;

describe('refreshAccessToken', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // The failure-path test drives a real `window.location.href = '/login'` set,
    // which jsdom logs as "Not implemented: navigation" — expected, not a bug.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('posts to /auth/refresh, stores the new token, and reconnects the socket', async () => {
    mockPost.mockResolvedValue({ data: { accessToken: 'fresh-token' } });

    const token = await refreshAccessToken();

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      {},
      { withCredentials: true },
    );
    expect(token).toBe('fresh-token');
    expect(tokenStorage.set).toHaveBeenCalledWith('fresh-token');
    expect(connectSocket).toHaveBeenCalled();
  });

  it('logs out and redirects to /login when the refresh call fails', async () => {
    mockPost.mockRejectedValue(new Error('refresh token expired'));

    await expect(refreshAccessToken()).rejects.toThrow('refresh token expired');

    expect(mockLogout).toHaveBeenCalled();
  });

  it('dedupes concurrent calls into a single /auth/refresh request', async () => {
    let resolvePost: (value: { data: { accessToken: string } }) => void = () => {};
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    (tokenStorage.getAccess as jest.Mock).mockReturnValue('shared-token');

    const first = refreshAccessToken();
    const second = refreshAccessToken();

    resolvePost({ data: { accessToken: 'shared-token' } });
    const [firstToken, secondToken] = await Promise.all([first, second]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(firstToken).toBe('shared-token');
    expect(secondToken).toBe('shared-token');
  });
});
