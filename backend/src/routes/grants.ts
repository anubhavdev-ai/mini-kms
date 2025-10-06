import { Router } from 'express';
import { GrantService } from '../services/grantService.js';
import { AuditService } from '../services/auditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';

export function createGrantRouter(grantService: GrantService, auditService: AuditService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      if (actor.role === 'app') {
        res.status(403).json({ error: 'Only admins or auditors can read grants' });
        return;
      }
      const grants = await grantService.list();
      res.json(grants);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      if (actor.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can manage grants' });
        return;
      }
      try {
        const grant = await grantService.upsertByPrincipal(req.body.principal, {
          role: req.body.role,
          keyId: req.body.keyId,
          allowedOps: req.body.allowedOps,
          conditions: req.body.conditions,
        });
        await auditService.record(actor, 'GRANT_CREATE', 'SUCCESS', {
          principal: grant.principal,
          keyId: grant.keyId,
        });
        res.status(201).json(grant);
      } catch (error) {
        await auditService.record(actor, 'GRANT_CREATE', 'FAILURE', {
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  return router;
}
