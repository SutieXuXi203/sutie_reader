import 'server-only';

import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { cache } from 'react';
import { createHash } from 'node:crypto';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { redisGet, redisSet, redisDelByPattern } from './redis';
import { revokeToken, isTokenRevoked } from './tokenBlacklist';

export { revokeToken, isTokenRevoked };

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'guest' | 'user' | 'admin';
}

const MIN_JWT_SECRET_LENGTH = 32;

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing');
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    const message = `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`[security] ${message}`);
  }
  return new TextEncoder().encode(secret);
}

export async function createSiteAccessToken(): Promise<string> {
  return new SignJWT({ scope: 'site_unlock' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifySiteAccessToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload.scope === 'site_unlock';
  } catch {
    return false;
  }
}

type LeanAuthUser = {
  _id: unknown;
  email?: string;
  name?: string;
  avatar?: string;
  role?: 'guest' | 'user' | 'admin';
  isVerified?: boolean;
};

type SessionPayload = {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  role?: 'guest' | 'user' | 'admin';
};

const getSessionPayload = cache(async (token?: string | null): Promise<SessionPayload | null> => {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const id =
      typeof payload.id === 'string'
        ? payload.id
        : typeof payload.userId === 'string'
          ? payload.userId
          : typeof payload.sub === 'string'
            ? payload.sub
            : null;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const name = typeof payload.name === 'string' ? payload.name : undefined;
    const avatar = typeof payload.avatar === 'string' ? payload.avatar : undefined;
    const role =
      payload.role === 'admin' || payload.role === 'user' || payload.role === 'guest'
        ? payload.role
        : undefined;

    if (!id) return null;

    return { id, email, name, avatar, role };
  } catch {
    return null;
  }
});

export async function getSessionUserFromToken(token?: string | null): Promise<AuthUser | null> {
  const payload = await getSessionPayload(token);
  if (!payload || !payload.email) return null;

  return {
    id: payload.id,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0] || payload.email,
    avatar: payload.avatar || '',
    role: payload.role || 'guest',
  };
}

const USER_CACHE_TTL_MS = 15_000;
const USER_REDIS_TTL_MS = 60_000;
const USER_CACHE_MAX_ENTRIES = 5_000;
const userMemoryCache = new Map<string, { user: AuthUser | null; expiresAt: number }>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

function setUserCache(token: string, user: AuthUser | null, ttlMs: number) {
  userMemoryCache.delete(token);
  if (userMemoryCache.size >= USER_CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of userMemoryCache) {
      if (entry.expiresAt <= now) userMemoryCache.delete(key);
    }
    while (userMemoryCache.size >= USER_CACHE_MAX_ENTRIES) {
      const oldest = userMemoryCache.keys().next().value;
      if (oldest === undefined) break;
      userMemoryCache.delete(oldest);
    }
  }
  userMemoryCache.set(token, { user, expiresAt: Date.now() + ttlMs });
}

export const getCurrentUserFromToken = cache(async (token?: string | null): Promise<AuthUser | null> => {
  if (!token) return null;

  // L1: RAM Memory Cache
  const now = Date.now();
  const cached = userMemoryCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  // Kiểm tra Token Blacklist (nếu có Redis)
  if (await isTokenRevoked(token)) {
    setUserCache(token, null, 10_000);
    return null;
  }

  // L2: Redis User Session Cache
  const tokenHash = hashToken(token);
  const sessionKey = `session:user:${tokenHash}`;
  const redisVal = await redisGet(sessionKey);
  if (redisVal !== null) {
    try {
      const user = JSON.parse(redisVal) as AuthUser | null;
      setUserCache(token, user, USER_CACHE_TTL_MS);
      return user;
    } catch {
      // Bỏ qua lỗi parse và truy vấn tiếp DB
    }
  }

  const payload = await getSessionPayload(token);
  if (!payload) return null;

  try {
    await connectDB();
    const user = (await User.findById(payload.id)
      .select('email name avatar role isVerified')
      .lean()) as LeanAuthUser | null;

    if (!user || !user.email || !user.role) {
      setUserCache(token, null, 10_000);
      void redisSet(sessionKey, JSON.stringify(null), 10_000);
      return null;
    }
    if (user.role !== 'admin' && user.isVerified !== true) {
      setUserCache(token, null, 10_000);
      void redisSet(sessionKey, JSON.stringify(null), 10_000);
      return null;
    }

    const authUser: AuthUser = {
      id: String(user._id),
      email: user.email,
      name: user.name || payload.name || user.email.split('@')[0] || user.email,
      avatar: typeof user.avatar === 'string' ? user.avatar : '',
      role: user.role,
    };

    setUserCache(token, authUser, USER_CACHE_TTL_MS);
    void redisSet(sessionKey, JSON.stringify(authUser), USER_REDIS_TTL_MS);
    return authUser;
  } catch {
    return null;
  }
});

export function clearUserCache(userId?: string): void {
  if (!userId) {
    userMemoryCache.clear();
  } else {
    for (const [token, entry] of userMemoryCache.entries()) {
      if (entry.user && entry.user.id === userId) {
        userMemoryCache.delete(token);
      }
    }
  }
  // Xóa session cache trên Redis để toàn bộ các serverless instance khác đồng bộ lập tức
  void redisDelByPattern('session:user:*');
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return getCurrentUserFromToken(cookieStore.get('token')?.value);
}
