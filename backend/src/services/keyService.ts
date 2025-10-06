import crypto from 'crypto';
import { StorageService } from './storageService.js';
import { EnvelopeService } from './envelopeService.js';
import {
  KeyRecord,
  KeyVersionRecord,
  KeyState,
  KeyVersionState,
  KeyType,
  KeyPurpose,
} from '../types/index.js';
import { config } from '../config.js';
import { generateKeyMaterial } from '../utils/crypto.js';

export interface CreateKeyInput {
  name: string;
  type: KeyType;
  purpose: KeyPurpose;
  rotationPeriodDays?: number;
  gracePeriodDays?: number;
  metadata?: Record<string, unknown>;
}

export interface KeyWithVersions extends KeyRecord {
  versions: KeyVersionRecord[];
}

export class KeyService {
  constructor(
    private readonly storage: StorageService,
    private readonly envelope: EnvelopeService
  ) {}

  async listKeys(): Promise<KeyRecord[]> {
    return this.storage.listKeys();
  }

  async getKey(id: string): Promise<KeyWithVersions | undefined> {
    const key = await this.storage.findKeyById(id);
    if (!key) return undefined;
    const versions = await this.storage.listVersionsForKey(id);
    return {
      ...key,
      versions,
    };
  }

  async createKey(input: CreateKeyInput): Promise<KeyWithVersions> {
    const existingByName = await this.storage.findKeyByName(input.name);
    if (existingByName) {
      throw new Error('Key with this name already exists');
    }

    const keyId = crypto.randomUUID();
    const versionNumber = 1;
    const { privateMaterial, publicMaterial } = generateKeyMaterial(input.type);
    const wrapped = await this.envelope.wrapSecret(privateMaterial, {
      keyId,
      version: versionNumber.toString(),
      type: input.type,
    });

    const keyRecord: KeyRecord = {
      id: keyId,
      name: input.name,
      type: input.type,
      purpose: input.purpose,
      state: 'ENABLED',
      rotationPeriodDays: input.rotationPeriodDays,
      gracePeriodDays: input.gracePeriodDays ?? config.gracePeriodDaysDefault,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
      currentVersion: versionNumber,
    };

    const versionRecord: KeyVersionRecord = {
      id: crypto.randomUUID(),
      keyId,
      version: versionNumber,
      state: 'ENABLED',
      createdAt: new Date().toISOString(),
      wrappedMaterial: wrapped,
      publicKeyPem: publicMaterial,
      gracePeriodDays: keyRecord.gracePeriodDays,
    };

    await this.storage.insertKey(keyRecord);
    await this.storage.insertVersion(versionRecord);

    return {
      ...keyRecord,
      versions: [versionRecord],
    };
  }

  async rotateKey(keyId: string): Promise<KeyWithVersions> {
    const key = await this.storage.findKeyById(keyId);
    if (!key) {
      throw new Error('Key not found');
    }
    if (key.state !== 'ENABLED') {
      throw new Error('Key must be enabled to rotate');
    }

    const currentVersion = await this.storage.findVersion(keyId, key.currentVersion);
    const newVersionNumber = key.currentVersion + 1;
    const { privateMaterial, publicMaterial } = generateKeyMaterial(key.type);
    const wrapped = await this.envelope.wrapSecret(privateMaterial, {
      keyId,
      version: newVersionNumber.toString(),
      type: key.type,
    });

    if (currentVersion && currentVersion.state === 'ENABLED') {
      currentVersion.state = 'DISABLED';
      currentVersion.notAfter =
        currentVersion.notAfter ??
        new Date(
          Date.now() + (currentVersion.gracePeriodDays ?? key.gracePeriodDays ?? config.gracePeriodDaysDefault) * 24 * 3600 * 1000
        ).toISOString();
      await this.storage.updateVersion(currentVersion);
    }

    const newVersion: KeyVersionRecord = {
      id: crypto.randomUUID(),
      keyId,
      version: newVersionNumber,
      state: 'ENABLED',
      createdAt: new Date().toISOString(),
      wrappedMaterial: wrapped,
      publicKeyPem: publicMaterial,
      gracePeriodDays: key.gracePeriodDays,
    };
    await this.storage.insertVersion(newVersion);

    const updatedKey: KeyRecord = {
      ...key,
      currentVersion: newVersionNumber,
    };
    await this.storage.updateKey(updatedKey);

    const versions = await this.storage.listVersionsForKey(keyId);
    return {
      ...updatedKey,
      versions,
    };
  }

  async setVersionState(
    keyId: string,
    version: number,
    state: KeyVersionState
  ): Promise<KeyWithVersions> {
    const key = await this.storage.findKeyById(keyId);
    if (!key) {
      throw new Error('Key not found');
    }

    const existing = await this.storage.findVersion(keyId, version);
    if (!existing) {
      throw new Error('Key version not found');
    }

    existing.state = state;
    existing.notAfter = state === 'REVOKED' ? new Date().toISOString() : existing.notAfter;
    await this.storage.updateVersion(existing);

    if (state === 'REVOKED' && key.currentVersion === version) {
      const updatedKey: KeyRecord = {
        ...key,
        state: 'DISABLED',
      };
      await this.storage.updateKey(updatedKey);
    }

    const versions = await this.storage.listVersionsForKey(keyId);
    const latestKey = await this.storage.findKeyById(keyId);
    if (!latestKey) {
      throw new Error('Key not found after update');
    }

    return {
      ...latestKey,
      versions,
    };
  }

  async setKeyState(keyId: string, state: KeyState): Promise<KeyWithVersions> {
    const key = await this.storage.findKeyById(keyId);
    if (!key) {
      throw new Error('Key not found');
    }
    const updatedKey: KeyRecord = {
      ...key,
      state,
    };
    await this.storage.updateKey(updatedKey);
    const versions = await this.storage.listVersionsForKey(keyId);
    return {
      ...updatedKey,
      versions,
    };
  }

  async getActiveVersion(keyId: string): Promise<{ key: KeyRecord; version: KeyVersionRecord }> {
    const key = await this.storage.findKeyById(keyId);
    if (!key) {
      throw new Error('Key not found');
    }
    if (key.state !== 'ENABLED') {
      throw new Error('Key is not enabled');
    }
    const version = await this.storage.findVersion(keyId, key.currentVersion);
    if (!version || version.state !== 'ENABLED') {
      throw new Error('Active version not available');
    }
    return { key, version };
  }

  async findVersion(keyId: string, versionNumber: number): Promise<KeyVersionRecord> {
    const version = await this.storage.findVersion(keyId, versionNumber);
    if (!version) {
      throw new Error('Key version not found');
    }
    return version;
  }

  async listDueForRotation(): Promise<KeyRecord[]> {
    const due = await this.storage.listKeysDueForRotation();
    return due.map((entry) => entry.key);
  }
}
