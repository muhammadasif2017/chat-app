'use client';

import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './auth';
import { useToastStore } from '../store/toast.store';

let socket: Socket | null = null;
const ACK_TIMEOUT_MS = 8000;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/chat`, {
      auth: { token: tokenStorage.getAccess() },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const token = tokenStorage.getAccess();
  if (!token) return;
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// The gateway's WsExceptionFilter emits a separate 'error' event on rejection —
// it never acks. So a missing ack here means either that (already toasted) or the
// request was silently dropped in flight. Only the latter needs a toast; skip it
// if an 'error' already arrived after we sent this request.
export function emitReliable(event: string, payload: unknown): void {
  const sentAt = Date.now();
  getSocket()
    .timeout(ACK_TIMEOUT_MS)
    .emit(event, payload, (err: Error | null) => {
      if (!err) return;
      if (useToastStore.getState().lastShownAt >= sentAt) return;
      useToastStore
        .getState()
        .show('Action may not have gone through. Please check your connection.');
    });
}
