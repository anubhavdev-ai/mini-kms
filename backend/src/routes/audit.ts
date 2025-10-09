import { Router } from 'express';
import { AuditService } from '../services/auditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';
import { BlockchainAnchorService } from '../services/blockchainAnchorService.js';

type AnchorOutcome =
  | {
      txHash: string;
      blockNumber?: number;
      network?: string;
      chainId?: number;
    }
  | { error: string };

export function createAuditRouter(
  auditService: AuditService,
  anchorService?: BlockchainAnchorService
): Router {
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
      let anchor: AnchorOutcome | undefined;
      if (result.ok && anchorService?.isEnabled()) {
        const head = await auditService.getLatestRecord();
        if (head) {
          try {
            anchor = await anchorService.anchor(head.hash, { recordId: head.id });
          } catch (error) {
            anchor = { error: (error as Error).message };
          }
        }
      }
      const response: Record<string, unknown> = { ...result };
      if (anchor) {
        response.anchor = anchor;
      }
      await auditService.record(
        actor,
        'AUDIT_VERIFY',
        result.ok ? 'SUCCESS' : 'FAILURE',
        response
      );
      res.json(response);
    })
  );

  return router;
}
