import { Router } from 'express';
import { CryptoService } from '../services/cryptoService.js';
import { AuditService } from '../services/auditService.js';
import { GrantService } from '../services/grantService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';

export function createCryptoRouter(
  cryptoService: CryptoService,
  auditService: AuditService,
  grantService: GrantService
): Router {
  const router = Router();

  router.post(
    '/encrypt',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const { keyId } = req.body;
      try {
        await grantService.ensureAuthorized(actor, 'encrypt', keyId);
        const result = await cryptoService.encrypt(req.body);
        await auditService.record(actor, 'ENCRYPT', 'SUCCESS', { keyId, version: result.version });
        res.json(result);
      } catch (error) {
        await auditService.record(actor, 'ENCRYPT', 'FAILURE', {
          keyId,
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  router.post(
    '/decrypt',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const { keyId, version } = req.body;
      try {
        await grantService.ensureAuthorized(actor, 'decrypt', keyId);
        const result = await cryptoService.decrypt(req.body);
        await auditService.record(actor, 'DECRYPT', 'SUCCESS', {
          keyId,
          version: version ?? result.version,
        });
        res.json(result);
      } catch (error) {
        await auditService.record(actor, 'DECRYPT', 'FAILURE', {
          keyId,
          version,
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  router.post(
    '/sign',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const { keyId, version } = req.body;
      try {
        await grantService.ensureAuthorized(actor, 'sign', keyId);
        const result = await cryptoService.sign(req.body);
        await auditService.record(actor, 'SIGN', 'SUCCESS', {
          keyId,
          version: version ?? result.version,
        });
        res.json(result);
      } catch (error) {
        await auditService.record(actor, 'SIGN', 'FAILURE', {
          keyId,
          version,
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  router.post(
    '/verify',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const { keyId, version } = req.body;
      try {
        await grantService.ensureAuthorized(actor, 'verify', keyId);
        const result = await cryptoService.verify(req.body);
        await auditService.record(actor, 'VERIFY', 'SUCCESS', {
          keyId,
          version: version ?? result.version,
          valid: result.valid,
        });
        res.json(result);
      } catch (error) {
        await auditService.record(actor, 'VERIFY', 'FAILURE', {
          keyId,
          version,
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  return router;
}
