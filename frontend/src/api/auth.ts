import { apiClient, Session } from './client';

export async function register(email: string, password: string): Promise<Session> {
  const { data } = await apiClient.post<Session>('/auth/register', { email, password });
  return data;
}

export async function login(email: string, password: string): Promise<Session> {
  const { data } = await apiClient.post<Session>('/auth/login', { email, password });
  return data;
}
