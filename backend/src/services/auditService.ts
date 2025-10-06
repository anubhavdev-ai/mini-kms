import crypto from 'crypto';
import { StorageService } from './storageService.js';
import { AuditAction, AuditRecord, ActorContext } from '../types/index.js';

function computeHash(prevHash: string, payload: AuditRecord): string {
  const hash = crypto.createHash('sha256');
  hash.update(prevHash);
  hash.update(
    JSON.stringify({
      id: payload.id,
      timestamp: payload.timestamp,
      actor: payload.actor,
      role: payload.role,
      action: payload.action,
      requestId: payload.requestId,
      details: payload.details,
      keyId: payload.keyId,
      keyVersion: payload.keyVersion,
      status: payload.status,
    })
  );
  return hash.digest('hex');
}

export class AuditService {
  constructor(private readonly storage: StorageService) {}

  async list(): Promise<AuditRecord[]> {
    return this.storage.listAuditLogs();
  }

  async record(
    context: ActorContext,
    action: AuditAction,
    status: 'SUCCESS' | 'FAILURE',
    details?: Record<string, unknown>,
    keyId?: string,
    keyVersion?: number
  ): Promise<AuditRecord> {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const previous = await this.storage.getLastAuditRecord();
    const prevHash = previous ? previous.hash : 'GENESIS';
    const record: AuditRecord = {
      id,
      timestamp,
      actor: context.principal,
      role: context.role,
      action,
      requestId: context.requestId,
      details,
      keyId,
      keyVersion,
      prevHash,
      hash: '',
      status,
    };
    record.hash = computeHash(prevHash, record);
    await this.storage.insertAuditRecord(record);
    return record;
  }

  async verifyChain(): Promise<{ ok: boolean; brokenAt?: string }> {
    const logs = await this.storage.listAuditLogs();
    let prevHash = 'GENESIS';
    for (const record of logs) {
      const expected = computeHash(prevHash, { ...record, hash: '' });
      if (record.hash !== expected) {
        return { ok: false, brokenAt: record.id };
      }
      prevHash = record.hash;
    }
    return { ok: true };
  }
}
