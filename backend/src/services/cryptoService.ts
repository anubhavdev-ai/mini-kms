import { EnvelopeService } from './envelopeService.js';
import { KeyService } from './keyService.js';
import {
  decryptWithAesGcm,
  encryptWithAesGcm,
  rsaDecrypt,
  rsaEncrypt,
  signWithRsa,
  verifyWithRsa,
} from '../utils/crypto.js';
import { KeyType } from '../types/index.js';

interface EncryptInput {
  keyId: string;
  plaintext: string;
  aad?: Record<string, string>;
}

interface EncryptResult {
  version: number;
  ciphertext: string;
  iv?: string;
  authTag?: string;
  keyType: KeyType;
}

interface DecryptInput {
  keyId: string;
  version?: number;
  ciphertext: string;
  iv?: string;
  authTag?: string;
  aad?: Record<string, string>;
}

interface DecryptResult {
  plaintext: string;
  version: number;
}

interface SignInput {
  keyId: string;
  payload: string;
  version?: number;
}

interface SignResult {
  signature: string;
  version: number;
}

interface VerifyInput {
  keyId: string;
  payload: string;
  signature: string;
  version?: number;
}

interface VerifyResult {
  valid: boolean;
  version: number;
}

function enforceVersionState(state: string, notAfter?: string) {
  if (state === 'REVOKED') {
    throw new Error('Key version is revoked');
  }
  if (state === 'DISABLED' && notAfter) {
    const expires = new Date(notAfter).getTime();
    if (Date.now() > expires) {
      throw new Error('Key version grace window has expired');
    }
  }
}

export class CryptoService {
  constructor(private readonly keyService: KeyService, private readonly envelope: EnvelopeService) {}

  async encrypt(input: EncryptInput): Promise<EncryptResult> {
    const { key, version } = await this.keyService.getActiveVersion(input.keyId);
    const secret = await this.envelope.unwrapSecret(version.wrappedMaterial);

    if (key.type === 'AES256_GCM') {
      const aad = Buffer.from(JSON.stringify({ keyId: key.id, version: version.version, ...input.aad }));
      const result = encryptWithAesGcm(secret, Buffer.from(input.plaintext, 'utf8'), aad);
      return {
        version: version.version,
        ciphertext: result.ciphertext,
        iv: result.iv,
        authTag: result.authTag,
        keyType: key.type,
      };
    }

    const ciphertext = rsaEncrypt(version.publicKeyPem!, Buffer.from(input.plaintext, 'utf8'));
    return {
      version: version.version,
      ciphertext,
      keyType: key.type,
    };
  }

  async decrypt(input: DecryptInput): Promise<DecryptResult> {
    const versionNumber = input.version ?? (await this.keyService.getActiveVersion(input.keyId)).version.version;
    const version = await this.keyService.findVersion(input.keyId, versionNumber);
    enforceVersionState(version.state, version.notAfter);
    const secret = await this.envelope.unwrapSecret(version.wrappedMaterial);

    const key = await this.keyService.getKey(input.keyId);
    if (!key) {
      throw new Error('Key not found');
    }

    if (key.type === 'AES256_GCM') {
      if (!input.iv || !input.authTag) {
        throw new Error('AES decryption requires iv and authTag');
      }
      const aad = Buffer.from(JSON.stringify({ keyId: key.id, version: version.version, ...input.aad }));
      const plaintext = decryptWithAesGcm(secret, input.iv, input.ciphertext, input.authTag, aad);
      return {
        version: version.version,
        plaintext: plaintext.toString('utf8'),
      };
    }

    const plaintext = rsaDecrypt(secret, input.ciphertext);
    return {
      version: version.version,
      plaintext: plaintext.toString('utf8'),
    };
  }

  async sign(input: SignInput): Promise<SignResult> {
    const versionNumber = input.version ?? (await this.keyService.getActiveVersion(input.keyId)).version.version;
    const version = await this.keyService.findVersion(input.keyId, versionNumber);
    if (!version.publicKeyPem) {
      throw new Error('Signing is only supported for asymmetric keys');
    }
    enforceVersionState(version.state, version.notAfter);
    const secret = await this.envelope.unwrapSecret(version.wrappedMaterial);
    const signature = signWithRsa(secret, Buffer.from(input.payload, 'utf8'));
    return {
      signature,
      version: version.version,
    };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const versionNumber = input.version ?? (await this.keyService.getActiveVersion(input.keyId)).version.version;
    const version = await this.keyService.findVersion(input.keyId, versionNumber);
    if (!version.publicKeyPem) {
      throw new Error('Verification is only supported for asymmetric keys');
    }
    enforceVersionState(version.state, version.notAfter);
    const valid = verifyWithRsa(version.publicKeyPem, Buffer.from(input.payload, 'utf8'), input.signature);
    return {
      valid,
      version: version.version,
    };
  }
}
