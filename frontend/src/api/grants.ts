import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface GrantRecord {
  id: string;
  principal: string;
  role: 'admin' | 'app' | 'auditor';
  keyId: string | '*';
  allowedOps: string[];
  createdAt: string;
  conditions?: Record<string, unknown>;
}

export function useGrants() {
  return useQuery({
    queryKey: ['grants'],
    queryFn: async () => {
      const { data } = await apiClient.get<GrantRecord[]>('/grants');
      return data;
    },
  });
}

interface UpsertGrantInput {
  principal: string;
  role: 'admin' | 'app' | 'auditor';
  keyId: string | '*';
  allowedOps: string[];
  conditions?: Record<string, unknown>;
}

export function useUpsertGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertGrantInput) => {
      const { data } = await apiClient.post('/grants', input);
      return data as GrantRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grants'] });
    },
  });
}
