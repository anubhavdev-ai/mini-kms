import { Router } from 'express';
import { AuditService } from '../services/auditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';

export function createAuditRouter(auditService: AuditService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      if (actor.role === 'app') {
        res.status(403).json({ error: 'Only admins or auditors can view audit logs' });
        return;
      }
      const logs = await auditService.list();
      res.json(logs);
    })
  );

  router.post(
    '/verify',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      if (actor.role === 'app') {
        res.status(403).json({ error: 'Only admins or auditors can verify logs' });
        return;
      }
      const result = await auditService.verifyChain();
      await auditService.record(actor, 'AUDIT_VERIFY', result.ok ? 'SUCCESS' : 'FAILURE', result);
      res.json(result);
    })
  );

  return router;
}
