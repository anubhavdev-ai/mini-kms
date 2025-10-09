import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { StorageService } from './storageService.js';
import { UserRecord } from '../types/index.js';
import { config } from '../config.js';

export interface PublicUser {
  id: string;
  email: string;
  role: 'admin' | 'user' | 'auditor';
}

export interface AuthSession {
  token: string;
  user: PublicUser;
}

export class UserService {
  constructor(private readonly storage: StorageService) {}

  private toPublic(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private generateToken(user: UserRecord): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const options: SignOptions = {
      expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, config.auth.jwtSecret as Secret, options);
  }

  private createSession(user: UserRecord): AuthSession {
    return {
      token: this.generateToken(user),
      user: this.toPublic(user),
    };
  }

  async register(email: string, password: string): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
    }
    const existing = await this.storage.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('EMAIL_IN_USE');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const totalUsers = await this.storage.countUsers();
    const role: PublicUser['role'] = totalUsers === 0 ? 'admin' : 'user';
    const user: UserRecord = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      role,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    await this.storage.insertUser(user);
    return this.createSession(user);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.storage.findUserByEmail(normalizedEmail);
    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new Error('INVALID_CREDENTIALS');
    }
    return this.createSession(user);
  }

  async findUserById(id: string): Promise<UserRecord | undefined> {
    return this.storage.findUserById(id);
  }
}
