import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ActorContext } from '../types/index.js';

export function extractActor(req: Request): ActorContext {
  const principal = (req.header('x-principal') ?? 'anonymous').toLowerCase();
  const roleHeader = (req.header('x-role') ?? 'app').toLowerCase();
  const role = roleHeader === 'admin' || roleHeader === 'auditor' ? roleHeader : 'app';
  const requestId = req.header('x-request-id') ?? crypto.randomUUID();
  return {
    principal,
    role: role as ActorContext['role'],
    requestId,
  };
}

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  (req as Request & { requestId: string }).requestId = requestId;
  next();
}
