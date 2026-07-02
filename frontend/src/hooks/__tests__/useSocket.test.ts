/* @jest-environment jsdom */
import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSocket } from '../useSocket';
import { getSocket, connectSocket, disconnectSocket } from '../../lib/socket';
import { refreshAccessToken } from '../../lib/api';
import { useToastStore } from '../../store/toast.store';

jest.mock('../../lib/socket', () => ({
  connectSocket: jest.fn(),
  disconnectSocket: jest.fn(),
  getSocket: jest.fn(),
  markGatewayErrorHandled: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
  refreshAccessToken: jest.fn(() => Promise.resolve('new-token')),
}));

jest.mock('../../store/auth.store', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}));

function makeFakeSocket() {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  return {
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    emit: jest.fn(),
    trigger: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
  };
}

describe('useSocket', () => {
  let fakeSocket: ReturnType<typeof makeFakeSocket>;
  let qc: QueryClient;
  let wrapper: (props: { children: ReactNode }) => ReactNode;
  let invalidateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fakeSocket = makeFakeSocket();
    (getSocket as jest.Mock).mockReturnValue(fakeSocket);
    qc = new QueryClient();
    invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: qc }, children);
    useToastStore.setState({ message: null });
  });

  it('connects and subscribes to lifecycle events on mount', () => {
    renderHook(() => useSocket(), { wrapper });
    expect(connectSocket).toHaveBeenCalled();
    expect(fakeSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(fakeSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(fakeSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(fakeSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });

  it('refreshes the token when the server force-disconnects the socket', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('disconnect', 'io server disconnect');
    expect(refreshAccessToken).toHaveBeenCalled();
  });

  it('does not refresh the token for an ordinary transport disconnect', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('disconnect', 'transport close');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('does not resync on the initial connect', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('connect');
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('resyncs conversations and messages after reconnecting from a real disconnect', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('disconnect', 'transport close');
    fakeSocket.trigger('connect');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['messages'] });
  });

  it('shows a toast for a gateway error with a string message', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('error', { message: 'Not a member' });
    expect(useToastStore.getState().message).toBe('Not a member');
  });

  it('joins array error messages into one toast', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('error', { message: ['field a is required', 'field b is required'] });
    expect(useToastStore.getState().message).toBe('field a is required, field b is required');
  });

  it('shows connect_error only once per outage, resetting on the next connect', () => {
    renderHook(() => useSocket(), { wrapper });
    fakeSocket.trigger('connect_error');
    fakeSocket.trigger('connect_error');
    fakeSocket.trigger('connect_error');
    expect(useToastStore.getState().message).toBe('Unable to reach the server. Retrying…');

    useToastStore.getState().clear();
    fakeSocket.trigger('connect');
    fakeSocket.trigger('connect_error');
    expect(useToastStore.getState().message).toBe('Unable to reach the server. Retrying…');
  });

  it('unsubscribes and disconnects on unmount', () => {
    const { unmount } = renderHook(() => useSocket(), { wrapper });
    unmount();
    expect(fakeSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(fakeSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(fakeSocket.off).toHaveBeenCalledWith('error', expect.any(Function));
    expect(fakeSocket.off).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(disconnectSocket).toHaveBeenCalled();
  });
});
