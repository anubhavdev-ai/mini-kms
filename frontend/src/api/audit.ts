import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action:
    | 'KEY_CREATE'
    | 'KEY_ROTATE'
    | 'KEY_REVOKE'
    | 'KEY_DISABLE'
    | 'KEY_ENABLE'
    | 'ENCRYPT'
    | 'DECRYPT'
    | 'SIGN'
    | 'VERIFY'
    | 'GRANT_CREATE'
    | 'GRANT_UPDATE'
    | 'AUDIT_VERIFY'
    | 'HEALTH_CHECK'
    | 'AUTH_REGISTER'
    | 'AUTH_LOGIN';
  requestId: string;
  details?: Record<string, unknown>;
  keyId?: string;
  keyVersion?: number;
  prevHash: string;
  hash: string;
  status: 'SUCCESS' | 'FAILURE';
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditRecord[]>('/audit');
      return data;
    },
    refetchInterval: 5000,
  });
}

export interface AuditVerifyResponse {
  ok: boolean;
  brokenAt?: string;
  legacy?: string[];
  anchor?:
    | {
        txHash: string;
        blockNumber?: number;
        network?: string;
        chainId?: number;
      }
    | {
        error: string;
      };
}

export function useAuditVerify() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<AuditVerifyResponse>('/audit/verify', {});
      return data;
    },
  });
}
