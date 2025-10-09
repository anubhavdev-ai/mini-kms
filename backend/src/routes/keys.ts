import { Router } from 'express';
import { KeyService } from '../services/keyService.js';
import { AuditService } from '../services/auditService.js';
import { GrantService } from '../services/grantService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extractActor } from '../utils/http.js';
import type { GrantOperation } from '../types/index.js';

export function createKeyRouter(
  keyService: KeyService,
  auditService: AuditService,
  grantService: GrantService
): Router {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      if (actor.role !== 'admin') {
        try {
          await grantService.ensureAuthorized(actor, 'create', '*');
        } catch (error) {
          res.status(403).json({ error: (error as Error).message });
          return;
        }
      }
      try {
        const keyInput = {
          ...req.body,
          metadata: {
            ...(req.body?.metadata ?? {}),
            owner: req.body?.metadata?.owner ?? actor.principal,
          },
        };

        const created = await keyService.createKey(keyInput);

        if (actor.role !== 'admin') {
          const manageOps: GrantOperation[] = [
            'read',
            'encrypt',
            'decrypt',
            'sign',
            'verify',
            'rotate',
            'revoke',
          ];
          await grantService.upsertByPrincipal(actor.principal, {
            role: actor.role,
            keyId: created.id,
            allowedOps: manageOps,
            conditions: undefined,
          });
        }

        await auditService.record(actor, 'KEY_CREATE', 'SUCCESS', {
          keyId: created.id,
          type: created.type,
          owner: created.metadata?.owner ?? actor.principal,
        });
        res.status(201).json(created);
      } catch (error) {
        await auditService.record(actor, 'KEY_CREATE', 'FAILURE', {
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      try {
        await grantService.ensureAuthorized(actor, 'read', '*');
        const keys = await keyService.listKeys();
        res.json(keys);
      } catch (error) {
        res.status(403).json({ error: (error as Error).message });
      }
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const keyId = req.params.id;
      try {
        await grantService.ensureAuthorized(actor, 'read', keyId);
        const key = await keyService.getKey(keyId);
        if (!key) {
          res.status(404).json({ error: 'Key not found' });
          return;
        }
        res.json(key);
      } catch (error) {
        res.status(403).json({ error: (error as Error).message });
      }
    })
  );

  router.post(
    '/:id/rotate',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const keyId = req.params.id;
      try {
        await grantService.ensureAuthorized(actor, 'rotate', keyId);
        const rotated = await keyService.rotateKey(keyId);
        await auditService.record(actor, 'KEY_ROTATE', 'SUCCESS', { keyId, newVersion: rotated.currentVersion });
        res.json(rotated);
      } catch (error) {
        await auditService.record(actor, 'KEY_ROTATE', 'FAILURE', {
          keyId,
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  router.post(
    '/:id/versions/:version/disable',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const keyId = req.params.id;
      const version = Number(req.params.version);
      try {
        await grantService.ensureAuthorized(actor, 'revoke', keyId);
        const updated = await keyService.setVersionState(keyId, version, 'DISABLED');
        await auditService.record(actor, 'KEY_DISABLE', 'SUCCESS', { keyId, version });
        res.json(updated);
      } catch (error) {
        await auditService.record(actor, 'KEY_DISABLE', 'FAILURE', {
          keyId,
          version,
          error: (error as Error).message,
        });
        res.status(400).json({ error: (error as Error).message });
      }
    })
  );

  router.post(
    '/:id/versions/:version/revoke',
    asyncHandler(async (req, res) => {
      const actor = extractActor(req);
      const keyId = req.params.id;
      const version = Number(req.params.version);
      try {
        await grantService.ensureAuthorized(actor, 'revoke', keyId);
        const updated = await keyService.setVersionState(keyId, version, 'REVOKED');
        await auditService.record(actor, 'KEY_REVOKE', 'SUCCESS', { keyId, version });
        res.json(updated);
      } catch (error) {
        await auditService.record(actor, 'KEY_REVOKE', 'FAILURE', {
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
