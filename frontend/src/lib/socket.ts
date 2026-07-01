'use client';

import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './auth';

let socket: Socket | null = null;

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
