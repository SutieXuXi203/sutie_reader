import 'server-only';

import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { cache } from 'react';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'guest' | 'user' | 'admin';
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing');
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

const USER_CACHE_TTL_MS = 60_000;
const userMemoryCache = new Map<string, { user: AuthUser | null; expiresAt: number }>();

export const getCurrentUserFromToken = cache(async (token?: string | null): Promise<AuthUser | null> => {
  if (!token) return null;

  const now = Date.now();
  const cached = userMemoryCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  const payload = await getSessionPayload(token);
  if (!payload) return null;

  try {
    await connectDB();
    const user = (await User.findById(payload.id)
      .select('email name avatar role isVerified')
      .lean()) as LeanAuthUser | null;

    if (!user || !user.email || !user.role) {
      userMemoryCache.set(token, { user: null, expiresAt: now + 10_000 });
      return null;
    }
    if (user.role !== 'admin' && user.isVerified !== true) {
      userMemoryCache.set(token, { user: null, expiresAt: now + 10_000 });
      return null;
    }

    const authUser: AuthUser = {
      id: String(user._id),
      email: user.email,
      name: user.name || payload.name || user.email.split('@')[0] || user.email,
      avatar: typeof user.avatar === 'string' ? user.avatar : '',
      role: user.role,
    };

    userMemoryCache.set(token, { user: authUser, expiresAt: now + USER_CACHE_TTL_MS });
    return authUser;
  } catch {
    return null;
  }
});

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return getCurrentUserFromToken(cookieStore.get('token')?.value);
}
