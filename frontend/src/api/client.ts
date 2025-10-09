import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/v1';

export interface SessionUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'auditor';
}

export interface Session {
  token: string;
  user: SessionUser;
}

const storageKey = 'mini-kms-session';

let currentSession: Session | null = null;

function loadSessionFromStorage(): Session | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored) as Session;
    if (parsed && typeof parsed.token === 'string' && parsed.user) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse stored session', error);
  }
  return null;
}

export function setSession(session: Session | null): void {
  currentSession = session;
  if (typeof window !== 'undefined') {
    if (session) {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }
}

export function getSession(): Session | null {
  if (currentSession) {
    return currentSession;
  }
  currentSession = loadSessionFromStorage();
  return currentSession;
}

export function clearSession(): void {
  setSession(null);
}

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const session = currentSession ?? getSession();
  if (session?.token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearSession();
    }
    return Promise.reject(error);
  }
);
