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
// it never acks, and it isn't correlated to which emitReliable call it belongs
// to. So a missing ack here means either that (already toasted via 'error') or
// the request was silently dropped in flight. Only the latter needs a toast.
// We can attribute an 'error' event unambiguously only when exactly one
// emitReliable call is in flight; with concurrent calls we can't tell which one
// it was for, so we let the ack timeout show its own toast rather than risk
// suppressing a genuinely dropped request.
let nextEmitId = 0;
const pendingEmits = new Map<number, boolean>();

export function markGatewayErrorHandled(): void {
  if (pendingEmits.size !== 1) return;
  const [id] = pendingEmits.keys();
  pendingEmits.set(id, true);
}

export function emitReliable(event: string, payload: unknown): void {
  const id = nextEmitId++;
  pendingEmits.set(id, false);
  getSocket()
    .timeout(ACK_TIMEOUT_MS)
    .emit(event, payload, (err: Error | null) => {
      const suppressed = pendingEmits.get(id);
      pendingEmits.delete(id);
      if (!err || suppressed) return;
      useToastStore
        .getState()
        .show('Action may not have gone through. Please check your connection.');
    });
}
