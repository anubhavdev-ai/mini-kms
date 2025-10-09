import crypto from 'crypto';
import { Router } from 'express';
import { UserService } from '../services/userService.js';
import { AuditService } from '../services/auditService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getRequestId(req: { requestId?: string; headers?: Record<string, unknown> }): string {
  if (req.requestId && typeof req.requestId === 'string') {
    return req.requestId;
  }
  const headerValue = req.headers && typeof req.headers['x-request-id'] === 'string' ? (req.headers['x-request-id'] as string) : undefined;
  return headerValue ?? crypto.randomUUID();
}

export function createAuthRouter(userService: UserService, auditService: AuditService): Router {
  const router = Router();

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      try {
        const session = await userService.register(email, password);
        await auditService.record(
          {
            principal: session.user.id,
            role: session.user.role === 'admin' ? 'admin' : 'app',
            requestId: getRequestId(req),
          },
          'AUTH_REGISTER',
          'SUCCESS',
          { email: session.user.email }
        );
        res.status(201).json(session);
      } catch (error) {
        if ((error as Error).message === 'EMAIL_IN_USE') {
          res.status(409).json({ error: 'Email already registered' });
          return;
        }
        if ((error as Error).message === 'EMAIL_AND_PASSWORD_REQUIRED') {
          res.status(400).json({ error: 'Email and password are required' });
          return;
        }
        throw error;
      }
    })
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      try {
        const session = await userService.login(email, password);
        await auditService.record(
          {
            principal: session.user.id,
            role: session.user.role === 'admin' ? 'admin' : 'app',
            requestId: getRequestId(req),
          },
          'AUTH_LOGIN',
          'SUCCESS',
          { email: session.user.email }
        );
        res.json(session);
      } catch (error) {
        if ((error as Error).message === 'INVALID_CREDENTIALS') {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
        throw error;
      }
    })
  );

  return router;
}
