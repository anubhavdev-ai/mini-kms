import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../db.js';
import {
  AuditRecord,
  GrantRecord,
  KeyRecord,
  KeyVersionRecord,
} from '../types/index.js';

function parseJson<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }
  return value as T;
}

function toDateString(date: Date | string): string {
  return typeof date === 'string' ? date : date.toISOString();
}

function toMysqlDateTime(value: string | Date | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const pad = (input: number) => input.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

type KeyRow = RowDataPacket & {
  id: string;
  name: string;
  type: string;
  purpose: string;
  state: string;
  rotation_period_days: number | null;
  grace_period_days: number | null;
  created_at: Date;
  metadata: string | null;
  current_version: number;
};

type KeyVersionRow = RowDataPacket & {
  id: string;
  key_id: string;
  version: number;
  state: string;
  created_at: Date;
  not_before: Date | null;
  not_after: Date | null;
  wrapped_material: string;
  public_key_pem: string | null;
  grace_period_days: number | null;
};

type GrantRow = RowDataPacket & {
  id: string;
  principal: string;
  role: string;
  key_id: string;
  allowed_ops: string;
  conditions: string | null;
  created_at: Date;
};

type AuditRow = RowDataPacket & {
  id: string;
  timestamp: Date;
  actor: string;
  role: string;
  action: string;
  request_id: string;
  details: string | null;
  key_id: string | null;
  key_version: number | null;
  prev_hash: string;
  hash: string;
  status: string;
};

function mapKey(row: KeyRow): KeyRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type as KeyRecord['type'],
    purpose: row.purpose as KeyRecord['purpose'],
    state: row.state as KeyRecord['state'],
    rotationPeriodDays: row.rotation_period_days ?? undefined,
    gracePeriodDays: row.grace_period_days ?? undefined,
    createdAt: toDateString(row.created_at),
    metadata: parseJson<Record<string, unknown>>(row.metadata) ?? undefined,
    currentVersion: row.current_version,
  };
}

function mapKeyVersion(row: KeyVersionRow): KeyVersionRecord {
  return {
    id: row.id,
    keyId: row.key_id,
    version: row.version,
    state: row.state as KeyVersionRecord['state'],
    createdAt: toDateString(row.created_at),
    notBefore: row.not_before ? toDateString(row.not_before) : undefined,
    notAfter: row.not_after ? toDateString(row.not_after) : undefined,
    wrappedMaterial: parseJson(row.wrapped_material) ?? {
      algorithm: 'AES-256-GCM',
      ciphertext: '',
    },
    publicKeyPem: row.public_key_pem ?? undefined,
    gracePeriodDays: row.grace_period_days ?? undefined,
  };
}

function mapGrant(row: GrantRow): GrantRecord {
  const allowedOps = (parseJson<string[]>(row.allowed_ops) ?? []).filter(Boolean);
  return {
    id: row.id,
    principal: row.principal,
    role: row.role as GrantRecord['role'],
    keyId: row.key_id,
    allowedOps: allowedOps as GrantRecord['allowedOps'],
    conditions: parseJson<Record<string, unknown>>(row.conditions) ?? undefined,
    createdAt: toDateString(row.created_at),
  };
}

function mapAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    timestamp: toDateString(row.timestamp),
    actor: row.actor,
    role: row.role,
    action: row.action as AuditRecord['action'],
    requestId: row.request_id,
    details: parseJson<Record<string, unknown>>(row.details) ?? undefined,
    keyId: row.key_id ?? undefined,
    keyVersion: row.key_version ?? undefined,
    prevHash: row.prev_hash,
    hash: row.hash,
    status: row.status as AuditRecord['status'],
  };
}

export class StorageService {
  async listKeys(): Promise<KeyRecord[]> {
    const [rows] = await pool.query<KeyRow[]>('SELECT * FROM `keys` ORDER BY name ASC');
    return rows.map(mapKey);
  }

  async findKeyById(id: string): Promise<KeyRecord | undefined> {
    const [rows] = await pool.query<KeyRow[]>('SELECT * FROM `keys` WHERE id = ?', [id]);
    return rows[0] ? mapKey(rows[0]) : undefined;
  }

  async findKeyByName(name: string): Promise<KeyRecord | undefined> {
    const [rows] = await pool.query<KeyRow[]>('SELECT * FROM `keys` WHERE name = ?', [name]);
    return rows[0] ? mapKey(rows[0]) : undefined;
  }

  async insertKey(record: KeyRecord): Promise<void> {
    await pool.execute(
      `INSERT INTO \`keys\` (id, name, type, purpose, state, rotation_period_days, grace_period_days, created_at, metadata, current_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.name,
        record.type,
        record.purpose,
        record.state,
        record.rotationPeriodDays ?? null,
        record.gracePeriodDays ?? null,
        toMysqlDateTime(record.createdAt),
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.currentVersion,
      ]
    );
  }

  async updateKey(record: KeyRecord): Promise<void> {
    await pool.execute(
      `UPDATE \`keys\`
       SET name = ?, type = ?, purpose = ?, state = ?, rotation_period_days = ?, grace_period_days = ?, created_at = ?, metadata = ?, current_version = ?
       WHERE id = ?`,
      [
        record.name,
        record.type,
        record.purpose,
        record.state,
        record.rotationPeriodDays ?? null,
        record.gracePeriodDays ?? null,
        toMysqlDateTime(record.createdAt),
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.currentVersion,
        record.id,
      ]
    );
  }

  async listVersionsForKey(keyId: string): Promise<KeyVersionRecord[]> {
    const [rows] = await pool.query<KeyVersionRow[]>(
      'SELECT * FROM `key_versions` WHERE key_id = ? ORDER BY version ASC',
      [keyId]
    );
    return rows.map(mapKeyVersion);
  }

  async getLatestVersionForKey(keyId: string): Promise<KeyVersionRecord | undefined> {
    const [rows] = await pool.query<KeyVersionRow[]>(
      'SELECT * FROM `key_versions` WHERE key_id = ? ORDER BY version DESC LIMIT 1',
      [keyId]
    );
    return rows[0] ? mapKeyVersion(rows[0]) : undefined;
  }

  async findVersion(keyId: string, version: number): Promise<KeyVersionRecord | undefined> {
    const [rows] = await pool.query<KeyVersionRow[]>(
      'SELECT * FROM `key_versions` WHERE key_id = ? AND version = ?',
      [keyId, version]
    );
    return rows[0] ? mapKeyVersion(rows[0]) : undefined;
  }

  async insertVersion(record: KeyVersionRecord): Promise<void> {
    await pool.execute(
      `INSERT INTO \`key_versions\` (id, key_id, version, state, created_at, not_before, not_after, wrapped_material, public_key_pem, grace_period_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.keyId,
        record.version,
        record.state,
        toMysqlDateTime(record.createdAt),
        toMysqlDateTime(record.notBefore ?? undefined),
        toMysqlDateTime(record.notAfter ?? undefined),
        JSON.stringify(record.wrappedMaterial),
        record.publicKeyPem ?? null,
        record.gracePeriodDays ?? null,
      ]
    );
  }

  async updateVersion(record: KeyVersionRecord): Promise<void> {
    await pool.execute(
      `UPDATE \`key_versions\`
       SET state = ?, created_at = ?, not_before = ?, not_after = ?, wrapped_material = ?, public_key_pem = ?, grace_period_days = ?
       WHERE id = ?`,
      [
        record.state,
        toMysqlDateTime(record.createdAt),
        toMysqlDateTime(record.notBefore ?? undefined),
        toMysqlDateTime(record.notAfter ?? undefined),
        JSON.stringify(record.wrappedMaterial),
        record.publicKeyPem ?? null,
        record.gracePeriodDays ?? null,
        record.id,
      ]
    );
  }

  async listKeysDueForRotation(): Promise<{ key: KeyRecord; latestVersion: KeyVersionRecord }[]> {
    const keys = await this.listKeys();
    const due: { key: KeyRecord; latestVersion: KeyVersionRecord }[] = [];
    for (const key of keys) {
      if (!key.rotationPeriodDays || key.state !== 'ENABLED') continue;
      const latest = await this.getLatestVersionForKey(key.id);
      if (!latest) continue;
      const createdAt = new Date(latest.createdAt).getTime();
      const dueTimestamp = createdAt + key.rotationPeriodDays * 24 * 3600 * 1000;
      if (dueTimestamp <= Date.now()) {
        due.push({ key, latestVersion: latest });
      }
    }
    return due;
  }

  async listGrants(): Promise<GrantRecord[]> {
    const [rows] = await pool.query<GrantRow[]>('SELECT * FROM `grants` ORDER BY principal ASC');
    return rows.map(mapGrant);
  }

  async upsertGrant(record: GrantRecord): Promise<void> {
    const allowedOps = JSON.stringify(record.allowedOps);
    const conditions = record.conditions ? JSON.stringify(record.conditions) : null;
    const existing = await this.findGrant(record.principal, record.keyId);
    if (existing) {
      await pool.execute(
        `UPDATE \`grants\`
         SET role = ?, allowed_ops = ?, conditions = ?, created_at = ?
         WHERE id = ?`,
        [
          record.role,
          allowedOps,
          conditions,
          toMysqlDateTime(record.createdAt),
          existing.id,
        ]
      );
      return;
    }

    await pool.execute(
      `INSERT INTO \`grants\` (id, principal, role, key_id, allowed_ops, conditions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.principal,
        record.role,
        record.keyId,
        allowedOps,
        conditions,
        toMysqlDateTime(record.createdAt),
      ]
    );
  }

  async findGrant(principal: string, keyId: string): Promise<GrantRecord | undefined> {
    const [rows] = await pool.query<GrantRow[]>(
      'SELECT * FROM `grants` WHERE principal = ? AND key_id = ? LIMIT 1',
      [principal, keyId]
    );
    return rows[0] ? mapGrant(rows[0]) : undefined;
  }

  async findGrantsForPrincipal(principal: string): Promise<GrantRecord[]> {
    const [rows] = await pool.query<GrantRow[]>(
      'SELECT * FROM `grants` WHERE principal = ?',
      [principal]
    );
    return rows.map(mapGrant);
  }

  async insertAuditRecord(record: AuditRecord): Promise<void> {
    await pool.execute(
      `INSERT INTO audit_logs (id, timestamp, actor, role, action, request_id, details, key_id, key_version, prev_hash, hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        toMysqlDateTime(record.timestamp),
        record.actor,
        record.role,
        record.action,
        record.requestId,
        record.details ? JSON.stringify(record.details) : null,
        record.keyId ?? null,
        record.keyVersion ?? null,
        record.prevHash,
        record.hash,
        record.status,
      ]
    );
  }

  async listAuditLogs(): Promise<AuditRecord[]> {
    const [rows] = await pool.query<AuditRow[]>('SELECT * FROM audit_logs ORDER BY timestamp ASC');
    return rows.map(mapAudit);
  }

  async getLastAuditRecord(): Promise<AuditRecord | undefined> {
    const [rows] = await pool.query<AuditRow[]>(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1'
    );
    return rows[0] ? mapAudit(rows[0]) : undefined;
  }
}
