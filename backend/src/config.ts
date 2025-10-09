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

const jwtSecret = process.env.AUTH_JWT_SECRET;
if (!jwtSecret) {
  console.warn(
    '[mini-kms] AUTH_JWT_SECRET not set. Using generated default for demo purposes. Set AUTH_JWT_SECRET to a strong secret in production.'
  );
}

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
  anchor: {
    enabled: process.env.ANCHOR_ENABLED === 'true',
    rpcUrl: process.env.ANCHOR_RPC_URL,
    privateKey: process.env.ANCHOR_PRIVATE_KEY,
    targetAddress:
      process.env.ANCHOR_TARGET_ADDRESS ?? '0x0000000000000000000000000000000000000000',
    chainId: process.env.ANCHOR_CHAIN_ID ? Number(process.env.ANCHOR_CHAIN_ID) : undefined,
    confirmations: Number(process.env.ANCHOR_CONFIRMATIONS ?? 1),
    networkName: process.env.ANCHOR_NETWORK_NAME,
  },
  auth: {
    jwtSecret: jwtSecret ?? crypto.randomBytes(32).toString('hex'),
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '1h',
  },
};
