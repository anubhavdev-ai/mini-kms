import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface KeyRecord {
  id: string;
  name: string;
  type: 'AES256_GCM' | 'RSA_2048';
  purpose: 'ENCRYPTION' | 'SIGNING';
  state: 'ENABLED' | 'DISABLED' | 'REVOKED';
  rotationPeriodDays?: number;
  gracePeriodDays?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
  currentVersion: number;
  versions?: KeyVersionRecord[];
}

export interface KeyVersionRecord {
  id: string;
  keyId: string;
  version: number;
  state: 'ENABLED' | 'DISABLED' | 'REVOKED';
  createdAt: string;
  notBefore?: string;
  notAfter?: string;
  publicKeyPem?: string;
}

export function useKeys() {
  return useQuery({
    queryKey: ['keys'],
    queryFn: async () => {
      const { data } = await apiClient.get<KeyRecord[]>('/keys');
      return data;
    },
    refetchInterval: 10000,
  });
}

export function useKey(keyId: string) {
  return useQuery({
    queryKey: ['keys', keyId],
    queryFn: async () => {
      const { data } = await apiClient.get<KeyRecord>(`/keys/${keyId}`);
      return data;
    },
    enabled: Boolean(keyId),
  });
}

export interface CreateKeyInput {
  name: string;
  type: 'AES256_GCM' | 'RSA_2048';
  purpose: 'ENCRYPTION' | 'SIGNING';
  rotationPeriodDays?: number;
  gracePeriodDays?: number;
  metadata?: Record<string, unknown>;
}

export function useCreateKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateKeyInput) => {
      const { data } = await apiClient.post('/keys', input);
      return data as KeyRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
    },
  });
}

export function useRotateKey(keyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post(`/keys/${keyId}/rotate`, {});
      return data as KeyRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      queryClient.invalidateQueries({ queryKey: ['keys', keyId] });
    },
  });
}

export function useDisableVersion(keyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) => {
      const { data } = await apiClient.post(`/keys/${keyId}/versions/${version}/disable`, {});
      return data as KeyRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      queryClient.invalidateQueries({ queryKey: ['keys', keyId] });
    },
  });
}

export function useRevokeVersion(keyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (version: number) => {
      const { data } = await apiClient.post(`/keys/${keyId}/versions/${version}/revoke`, {});
      return data as KeyRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys'] });
      queryClient.invalidateQueries({ queryKey: ['keys', keyId] });
    },
  });
}
