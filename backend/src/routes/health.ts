import { Router } from 'express';
import { AuditService } from '../services/auditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';

export function createHealthRouter(auditService: AuditService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      await auditService.record(actor, 'HEALTH_CHECK', 'SUCCESS', { path: '/v1/healthz' });
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    })
  );

  return router;
}
