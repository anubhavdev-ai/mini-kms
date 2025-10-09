import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ActorContext } from '../types/index.js';
import { AuthenticatedRequest } from '../middleware/authenticate.js';

export function extractActor(req: Request): ActorContext {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user) {
    throw new Error('Missing authenticated user context');
  }
  const requestId = authReq.requestId ?? req.header('x-request-id') ?? crypto.randomUUID();
  const actorRole: ActorContext['role'] =
    user.role === 'admin' ? 'admin' : user.role === 'auditor' ? 'auditor' : 'app';
  return {
    principal: user.id,
    role: actorRole,
    requestId,
  };
}

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as AuthenticatedRequest).requestId = requestId;
  next();
}
