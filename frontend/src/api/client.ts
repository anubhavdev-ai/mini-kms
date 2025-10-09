import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/v1';
const defaultPrincipal = import.meta.env.VITE_DEFAULT_PRINCIPAL || 'demo-admin';
const defaultRole = (import.meta.env.VITE_DEFAULT_ROLE as 'admin' | 'app' | 'auditor') || 'admin';

let currentPrincipal = defaultPrincipal;
let currentRole: 'admin' | 'app' | 'auditor' = defaultRole;

export function setActor(context: { principal: string; role: 'admin' | 'app' | 'auditor' }) {
  currentPrincipal = context.principal.trim() || defaultPrincipal;
  currentRole = context.role;
}

export function getActor(): { principal: string; role: 'admin' | 'app' | 'auditor' } {
  return {
    principal: currentPrincipal,
    role: currentRole,
  };
}

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers['x-principal'] = config.headers['x-principal'] ?? currentPrincipal;
  config.headers['x-role'] = config.headers['x-role'] ?? currentRole;
  return config;
});
