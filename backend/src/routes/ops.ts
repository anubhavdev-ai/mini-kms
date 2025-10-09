import { Router } from 'express';
import { OpsService } from '../services/opsService.js';
import { GrantService } from '../services/grantService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';

export function createOpsRouter(opsService: OpsService, grantService: GrantService): Router {
  const router = Router();

  router.get(
    '/metrics',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      await grantService.ensureAuthorized(actor, 'read', '*');
      const metrics = await opsService.getMetrics();
      res.json(metrics);
    })
  );

  return router;
}
