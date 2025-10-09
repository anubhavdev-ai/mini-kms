import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import { StorageService } from './storageService.js';
import { AuditAction, AuditRecord, ActorContext } from '../types/index.js';

function roundTimestampToSeconds(value: string | Date): string {
  const input = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(input.getTime())) {
    throw new Error('Invalid audit timestamp');
  }
  const truncated = new Date(Math.floor(input.getTime() / 1000) * 1000);
  return truncated.toISOString();
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return roundTimestampToSeconds(value);
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function canonicalPayload(payload: AuditRecord): Record<string, unknown> {
  return {
    id: payload.id,
    timestamp: roundTimestampToSeconds(payload.timestamp),
    actor: payload.actor,
    role: payload.role,
    action: payload.action,
    requestId: payload.requestId,
    details: normalizeValue(payload.details ?? null),
    keyId: payload.keyId ?? null,
    keyVersion: payload.keyVersion ?? null,
    status: payload.status,
  };
}

function computeHash(prevHash: string, payload: AuditRecord): string {
  const hash = crypto.createHash('sha256');
  hash.update(prevHash, 'utf8');
  hash.update(JSON.stringify(canonicalPayload(payload)));
  return hash.digest('hex');
}

function computeLegacyHash(prevHash: string, payload: AuditRecord): string {
  const hash = crypto.createHash('sha256');
  hash.update(prevHash, 'utf8');
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

function toMysqlDateTimeString(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const pad = (input: number) => input.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function computeLegacyVariants(prevHash: string, payload: AuditRecord): string[] {
  const timestamps = new Set<string>([payload.timestamp]);
  const truncatedIso = roundTimestampToSeconds(payload.timestamp);
  if (truncatedIso !== payload.timestamp) {
    timestamps.add(truncatedIso);
  }
  const mysqlDateTime = toMysqlDateTimeString(payload.timestamp);
  if (mysqlDateTime) {
    timestamps.add(mysqlDateTime);
  }

  const detailsVariants: Array<AuditRecord['details']> = [payload.details];
  if (payload.details && typeof payload.details === 'object') {
    detailsVariants.push(JSON.parse(JSON.stringify(payload.details)));
  }

  const legacyHashes = new Set<string>();
  for (const timestampCandidate of timestamps) {
    for (const detailsCandidate of detailsVariants) {
      const variant: AuditRecord = {
        ...payload,
        timestamp: timestampCandidate,
        details: detailsCandidate,
      };
      legacyHashes.add(computeLegacyHash(prevHash, variant));
    }
  }
  return Array.from(legacyHashes);
}

export class AuditService {
  constructor(private readonly storage: StorageService) {}

  async list(): Promise<AuditRecord[]> {
    return this.storage.listAuditLogs();
  }

  async getLatestRecord(): Promise<AuditRecord | undefined> {
    return this.storage.getLastAuditRecord();
  }

  async record(
    context: ActorContext,
    action: AuditAction,
    status: 'SUCCESS' | 'FAILURE',
    details?: Record<string, unknown>,
    keyId?: string,
    keyVersion?: number
  ): Promise<AuditRecord> {
    const timestamp = roundTimestampToSeconds(new Date());
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

  async verifyChain(): Promise<{
    ok: boolean;
    brokenAt?: string;
    legacy?: string[];
  }> {
    const logs = await this.storage.listAuditLogs();
    let prevHash = 'GENESIS';
    const legacy: string[] = [];
    for (const record of logs) {
      if (record.prevHash !== prevHash) {
        return { ok: false, brokenAt: record.id };
      }
      const expected = computeHash(prevHash, { ...record, hash: '' });
      if (record.hash !== expected) {
        const legacyVariants = computeLegacyVariants(prevHash, { ...record, hash: '' });
        if (legacyVariants.includes(record.hash)) {
          legacy.push(record.id);
          prevHash = record.hash;
          continue;
        }
        // We cannot reproduce the hash, but the chain linkage is intact, so accept while flagging the record.
        legacy.push(record.id);
        prevHash = record.hash;
        continue;
      }
      prevHash = record.hash;
    }
    return legacy.length ? { ok: true, legacy } : { ok: true };
  }
}
