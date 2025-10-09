export type KeyType = 'AES256_GCM' | 'RSA_2048';
export type KeyPurpose = 'ENCRYPTION' | 'SIGNING';
export type KeyState = 'ENABLED' | 'DISABLED' | 'REVOKED';
export type KeyVersionState = 'ENABLED' | 'DISABLED' | 'REVOKED';

export type EnvelopeAlgorithm = 'AES-256-GCM' | 'AWS-KMS';

export interface EnvelopeCiphertext {
  algorithm: EnvelopeAlgorithm;
  iv?: string; // base64-encoded IV (GCM only)
  ciphertext: string; // base64-encoded ciphertext
  authTag?: string; // base64-encoded auth tag (GCM only)
  encryptionContext?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface KeyVersionRecord {
  id: string;
  keyId: string;
  version: number;
  state: KeyVersionState;
  createdAt: string;
  notBefore?: string;
  notAfter?: string;
  wrappedMaterial: EnvelopeCiphertext;
  publicKeyPem?: string; // RSA public key in PEM when applicable
  gracePeriodDays?: number;
}

export interface KeyRecord {
  id: string;
  name: string;
  type: KeyType;
  purpose: KeyPurpose;
  state: KeyState;
  rotationPeriodDays?: number;
  gracePeriodDays?: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
  currentVersion: number;
}

export type GrantOperation =
  | 'encrypt'
  | 'decrypt'
  | 'sign'
  | 'verify'
  | 'rotate'
  | 'revoke'
  | 'read'
  | 'create';

export interface GrantRecord {
  id: string;
  principal: string;
  role: 'admin' | 'app' | 'auditor';
  keyId: string | '*';
  allowedOps: GrantOperation[];
  conditions?: Record<string, unknown>;
  createdAt: string;
}

export type AuditAction =
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
  | 'HEALTH_CHECK';

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: AuditAction;
  requestId: string;
  details?: Record<string, unknown>;
  keyId?: string;
  keyVersion?: number;
  prevHash: string;
  hash: string;
  status: 'SUCCESS' | 'FAILURE';
}

export interface ActorContext {
  principal: string;
  role: 'admin' | 'app' | 'auditor';
  requestId: string;
}
