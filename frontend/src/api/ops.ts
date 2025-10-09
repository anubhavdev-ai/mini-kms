import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface OperationalMetrics {
  keys: {
    total: number;
    byState: Record<string, number>;
    totalVersions: number;
    rotationAlerts: Array<{
      id: string;
      name: string;
      rotationPeriodDays: number;
      gracePeriodDays?: number;
      daysSinceRotation?: number;
      lastRotatedAt?: string;
    }>;
  };
  audit: {
    lastVerification?: {
      id: string;
      timestamp: string;
      ok?: boolean;
      brokenAt?: string;
    };
    failuresLast24h: number;
  };
  usage: {
    encryptionsLast24h: number;
    decryptionsLast24h: number;
    rotationsLast30d: number;
  };
}

export function useOperationalMetrics() {
  return useQuery({
    queryKey: ['ops-metrics'],
    queryFn: async () => {
      const { data } = await apiClient.get<OperationalMetrics>('/ops/metrics');
      return data;
    },
    refetchInterval: 15000,
  });
}
