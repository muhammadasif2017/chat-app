import axios from 'axios';
import { tokenStorage } from './auth';
import { connectSocket, getSocket } from './socket';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
}

// Shared by the 401 interceptor below and by useSocket's server-disconnect handler,
// so a socket kicked for an expired token and an HTTP 401 don't race separate refreshes.
export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise<void>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    }).then(() => tokenStorage.getAccess()!);
  }

  isRefreshing = true;
  try {
    // Tell the server which socket is us so its session_revoked broadcast (fired
    // on every rotation, per single-device enforcement) excludes this connection —
    // otherwise a normal self-triggered refresh would immediately log itself out.
    const socket = getSocket();
    const body = socket.connected ? { socketId: socket.id } : {};
    const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, body, {
      withCredentials: true,
    });
    tokenStorage.set(data.accessToken);
    connectSocket();
    processQueue(null);
    return data.accessToken;
  } catch (err) {
    processQueue(err);
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw err;
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (original.url?.match(/\/auth\/(login|register)$/)) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const accessToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (err) {
      return Promise.reject(err);
    }
  },
);

export default api;
