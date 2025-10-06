import { EncryptCommand, DecryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { config } from '../config.js';
import { EnvelopeCiphertext } from '../types/index.js';
import { wrapSecret as localWrap, unwrapSecret as localUnwrap } from '../utils/crypto.js';

export class EnvelopeService {
  private kmsClient?: KMSClient;

  constructor(private readonly masterKey: Buffer) {
    if (config.useAwsKms) {
      this.kmsClient = new KMSClient({});
    }
  }

  async wrapSecret(
    material: Buffer,
    context: Record<string, string>
  ): Promise<EnvelopeCiphertext> {
    if (config.useAwsKms) {
      if (!config.awsKmsKeyId) {
        throw new Error('KMS_AWS_KEY_ID must be set when KMS_USE_AWS=true');
      }
      if (!this.kmsClient) {
        throw new Error('AWS KMS client not initialised');
      }

      const response = await this.kmsClient.send(
        new EncryptCommand({
          KeyId: config.awsKmsKeyId,
          Plaintext: material,
          EncryptionContext: context,
        })
      );

      if (!response.CiphertextBlob) {
        throw new Error('AWS KMS encrypt did not return cipher text');
      }

      return {
        algorithm: 'AWS-KMS',
        ciphertext: Buffer.from(response.CiphertextBlob).toString('base64'),
        encryptionContext: context,
        metadata: {
          keyId: config.awsKmsKeyId,
        },
      };
    }

    const wrapped = localWrap(material, this.masterKey);
    return {
      algorithm: wrapped.algorithm,
      iv: wrapped.iv,
      ciphertext: wrapped.ciphertext,
      authTag: wrapped.authTag,
      encryptionContext: context,
    };
  }

  async unwrapSecret(wrapped: EnvelopeCiphertext): Promise<Buffer> {
    if (wrapped.algorithm === 'AWS-KMS') {
      if (!this.kmsClient) {
        throw new Error('AWS KMS client not available for unwrap');
      }
      const response = await this.kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: Buffer.from(wrapped.ciphertext, 'base64'),
          EncryptionContext: wrapped.encryptionContext,
          KeyId: wrapped.metadata?.keyId as string | undefined,
        })
      );
      if (!response.Plaintext) {
        throw new Error('AWS KMS decrypt returned empty result');
      }
      return Buffer.from(response.Plaintext);
    }

    return localUnwrap(wrapped, this.masterKey);
  }
}
