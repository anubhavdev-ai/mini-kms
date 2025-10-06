import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';

export interface EncryptPayload {
  keyId: string;
  plaintext: string;
  aad?: Record<string, string>;
}

export interface EncryptResponse {
  version: number;
  ciphertext: string;
  iv?: string;
  authTag?: string;
  keyType: 'AES256_GCM' | 'RSA_2048';
}

export interface DecryptPayload {
  keyId: string;
  ciphertext: string;
  iv?: string;
  authTag?: string;
  version?: number;
  aad?: Record<string, string>;
}

export interface DecryptResponse {
  version: number;
  plaintext: string;
}

export function useEncrypt() {
  return useMutation({
    mutationFn: async (payload: EncryptPayload) => {
      const { data } = await apiClient.post<EncryptResponse>('/crypto/encrypt', payload);
      return data;
    },
  });
}

export function useDecrypt() {
  return useMutation({
    mutationFn: async (payload: DecryptPayload) => {
      const { data } = await apiClient.post<DecryptResponse>('/crypto/decrypt', payload);
      return data;
    },
  });
}

export interface SignPayload {
  keyId: string;
  payload: string;
  version?: number;
}

export interface SignResponse {
  version: number;
  signature: string;
}

export function useSign() {
  return useMutation({
    mutationFn: async (payload: SignPayload) => {
      const { data } = await apiClient.post<SignResponse>('/crypto/sign', payload);
      return data;
    },
  });
}

export interface VerifyPayload {
  keyId: string;
  payload: string;
  signature: string;
  version?: number;
}

export interface VerifyResponse {
  version: number;
  valid: boolean;
}

export function useVerify() {
  return useMutation({
    mutationFn: async (payload: VerifyPayload) => {
      const { data } = await apiClient.post<VerifyResponse>('/crypto/verify', payload);
      return data;
    },
  });
}
