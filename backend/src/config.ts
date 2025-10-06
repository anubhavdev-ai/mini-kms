import crypto from 'crypto';

const masterKeySource = process.env.KMS_MASTER_KEY;

if (!masterKeySource) {
  console.warn(
    '[mini-kms] KMS_MASTER_KEY not set. Using generated volatile key for demo purposes. Set KMS_MASTER_KEY to a strong secret for persistence.'
  );
}

const derivedMasterKey = crypto
  .createHash('sha256')
  .update(masterKeySource ?? crypto.randomBytes(32))
  .digest();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  masterKey: derivedMasterKey,
  gracePeriodDaysDefault: Number(process.env.KMS_GRACE_DAYS ?? 7),
  useAwsKms: process.env.KMS_USE_AWS === 'true',
  awsKmsKeyId: process.env.KMS_AWS_KEY_ID,
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'mini_kms',
    connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
  },
};
