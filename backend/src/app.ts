import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { StorageService } from './services/storageService.js';
import { EnvelopeService } from './services/envelopeService.js';
import { KeyService } from './services/keyService.js';
import { AuditService } from './services/auditService.js';
import { GrantService } from './services/grantService.js';
import { CryptoService } from './services/cryptoService.js';
import { createKeyRouter } from './routes/keys.js';
import { createCryptoRouter } from './routes/crypto.js';
import { createGrantRouter } from './routes/grants.js';
import { createAuditRouter } from './routes/audit.js';
import { createHealthRouter } from './routes/health.js';
import { startRotationScheduler } from './services/scheduler.js';
import { attachRequestId } from './utils/http.js';
import { OpsService } from './services/opsService.js';
import { createOpsRouter } from './routes/ops.js';

export function createApp() {
  const app = express();

  const storage = new StorageService();
  const envelope = new EnvelopeService(config.masterKey);
  const keyService = new KeyService(storage, envelope);
  const auditService = new AuditService(storage);
  const grantService = new GrantService(storage);
  const cryptoService = new CryptoService(keyService, envelope);
  const opsService = new OpsService(storage);

  startRotationScheduler(keyService, auditService);

  app.use(attachRequestId);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined'));

  app.use('/v1/healthz', createHealthRouter(auditService));
  app.use('/v1/keys', createKeyRouter(keyService, auditService, grantService));
  app.use('/v1/crypto', createCryptoRouter(cryptoService, auditService, grantService));
  app.use('/v1/grants', createGrantRouter(grantService, auditService));
  app.use('/v1/audit', createAuditRouter(auditService));
  app.use('/v1/ops', createOpsRouter(opsService, grantService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
