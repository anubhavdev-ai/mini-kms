import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/v1';
const defaultPrincipal = import.meta.env.VITE_DEFAULT_PRINCIPAL || 'demo-admin';
const defaultRole = import.meta.env.VITE_DEFAULT_ROLE || 'admin';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers['x-principal'] = config.headers['x-principal'] ?? defaultPrincipal;
  config.headers['x-role'] = config.headers['x-role'] ?? defaultRole;
  return config;
});
