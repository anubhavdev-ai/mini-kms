import crypto from 'crypto';
import { StorageService } from './storageService.js';
import { ActorContext, GrantOperation, GrantRecord } from '../types/index.js';

export class GrantService {
  constructor(private readonly storage: StorageService) {}

  async list(): Promise<GrantRecord[]> {
    return this.storage.listGrants();
  }

  async upsertByPrincipal(
    principal: string,
    input: Omit<GrantRecord, 'id' | 'principal' | 'createdAt'>
  ): Promise<GrantRecord> {
    const now = new Date().toISOString();
    const existing = await this.storage.findGrant(principal, input.keyId);
    if (existing) {
      const updated: GrantRecord = {
        ...existing,
        role: input.role,
        keyId: input.keyId,
        allowedOps: input.allowedOps,
        conditions: input.conditions,
        createdAt: now,
      };
      await this.storage.upsertGrant(updated);
      return updated;
    }

    const record: GrantRecord = {
      id: crypto.randomUUID(),
      principal,
      role: input.role,
      keyId: input.keyId,
      allowedOps: input.allowedOps,
      conditions: input.conditions,
      createdAt: now,
    };
    await this.storage.upsertGrant(record);
    return record;
  }

  async ensureAuthorized(
    actor: ActorContext,
    operation: GrantOperation,
    keyId: string | '*'
  ): Promise<void> {
    if (actor.role === 'admin') {
      return;
    }

    if (actor.role === 'auditor') {
      if (operation === 'read') {
        return;
      }
      throw new Error('Auditor role cannot perform this operation');
    }

    const grants = await this.storage.findGrantsForPrincipal(actor.principal);
    const grant = grants.find(
      (g) => (g.keyId === keyId || g.keyId === '*') && g.allowedOps.includes(operation)
    );

    if (!grant) {
      throw new Error('Access denied: no matching grant');
    }
  }
}
