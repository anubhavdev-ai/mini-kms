import { StorageService } from './storageService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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
      ok: boolean | undefined;
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

function countByAction(
  rows: Array<{ action: string; status: string; total: number }>,
  action: string
): number {
  return rows
    .filter((row) => row.action === action)
    .reduce((sum, row) => sum + Number(row.total), 0);
}

export class OpsService {
  constructor(private readonly storage: StorageService) {}

  async getMetrics(): Promise<OperationalMetrics> {
    const now = new Date();
    const [keyStateCounts, totalVersions, rotationCandidates, audit24h, audit30d, lastVerify] =
      await Promise.all([
        this.storage.countKeysByState(),
        this.storage.countKeyVersions(),
        this.storage.findRotationCandidates(),
        this.storage.countAuditActionsSince(new Date(now.getTime() - DAY_MS)),
        this.storage.countAuditActionsSince(new Date(now.getTime() - 30 * DAY_MS)),
        this.storage.getLastAuditVerification(),
      ]);

    const rotationAlerts = rotationCandidates
      .map((candidate) => {
        const lastRotated = candidate.lastRotatedAt ? new Date(candidate.lastRotatedAt) : undefined;
        const daysSinceRotation =
          lastRotated !== undefined
            ? Math.floor((now.getTime() - lastRotated.getTime()) / DAY_MS)
            : undefined;
        return {
          ...candidate,
          daysSinceRotation,
        };
      })
      .filter(
        (candidate) =>
          candidate.rotationPeriodDays > 0 &&
          candidate.daysSinceRotation !== undefined &&
          candidate.daysSinceRotation >= candidate.rotationPeriodDays
      )
      .sort((a, b) => (b.daysSinceRotation ?? 0) - (a.daysSinceRotation ?? 0));

    const lastVerification = lastVerify
      ? {
          id: lastVerify.id,
          timestamp: lastVerify.timestamp,
          ok: (lastVerify.details as { ok?: boolean } | undefined)?.ok,
          brokenAt: (lastVerify.details as { brokenAt?: string } | undefined)?.brokenAt,
        }
      : undefined;

    return {
      keys: {
        total: Object.values(keyStateCounts).reduce((sum, value) => sum + value, 0),
        byState: keyStateCounts,
        totalVersions,
        rotationAlerts,
      },
      audit: {
        lastVerification,
        failuresLast24h: audit24h
          .filter((row) => row.action === 'AUDIT_VERIFY' && row.status === 'FAILURE')
          .reduce((sum, row) => sum + Number(row.total), 0),
      },
      usage: {
        encryptionsLast24h: countByAction(audit24h, 'ENCRYPT'),
        decryptionsLast24h: countByAction(audit24h, 'DECRYPT'),
        rotationsLast30d: countByAction(audit30d, 'KEY_ROTATE'),
      },
    };
  }
}
