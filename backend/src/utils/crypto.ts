import crypto from 'crypto';
import { EnvelopeCiphertext, KeyType } from '../types/index.js';

export interface WrappedSecret {
  wrapped: EnvelopeCiphertext;
}

export function wrapSecret(secret: Buffer, masterKey: Buffer): EnvelopeCiphertext {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: 'AES-256-GCM',
  };
}

export function unwrapSecret(wrapped: EnvelopeCiphertext, masterKey: Buffer): Buffer {
  if (!wrapped.iv || !wrapped.authTag) {
    throw new Error('Missing IV or auth tag for AES wrapped secret');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    masterKey,
    Buffer.from(wrapped.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(wrapped.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(wrapped.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext;
}

export function generateKeyMaterial(type: KeyType): {
  privateMaterial: Buffer;
  publicMaterial?: string;
} {
  if (type === 'AES256_GCM') {
    return { privateMaterial: crypto.randomBytes(32) };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return {
    privateMaterial: Buffer.from(privateKey, 'utf8'),
    publicMaterial: publicKey,
  };
}

export function encryptWithAesGcm(
  key: Buffer,
  plaintext: Buffer,
  aad: Buffer
): { iv: string; ciphertext: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptWithAesGcm(
  key: Buffer,
  iv: string,
  ciphertext: string,
  authTag: string,
  aad: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);
}

export function signWithRsa(privateKeyPem: Buffer, payload: Buffer): string {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payload);
  signer.end();
  return signer.sign({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING }).toString('base64');
}

export function verifyWithRsa(publicKeyPem: string, payload: Buffer, signature: string): boolean {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(payload);
  verifier.end();
  return verifier.verify(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(signature, 'base64')
  );
}

export function rsaEncrypt(publicKeyPem: string, plaintext: Buffer): string {
  return crypto
    .publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      plaintext
    )
    .toString('base64');
}

export function rsaDecrypt(privateKeyPem: Buffer, ciphertext: string): Buffer {
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(ciphertext, 'base64')
  );
}
