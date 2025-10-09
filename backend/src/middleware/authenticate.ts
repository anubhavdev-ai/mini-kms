import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'auditor';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}

export function createAuthenticateMiddleware(userService: UserService) {
  return async function authenticate(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const authHeader = req.header('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload & {
        email?: string;
        role?: string;
      };
      const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const user = await userService.findUserById(userId);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      next();
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
