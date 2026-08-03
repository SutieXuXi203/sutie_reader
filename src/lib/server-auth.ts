import 'server-only';

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing');
  }
  return new TextEncoder().encode(secret);
}

type LeanAuthUser = {
  _id: unknown;
  email?: string;
  name?: string;
  avatar?: string;
  role?: 'user' | 'admin';
  isVerified?: boolean;
};

type SessionPayload = {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  role?: 'user' | 'admin';
};

async function getSessionPayload(token?: string | null): Promise<SessionPayload | null> {
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
      payload.role === 'admin' || payload.role === 'user' ? payload.role : undefined;

    if (!id) return null;

    return { id, email, name, avatar, role };
  } catch {
    return null;
  }
}

export async function getSessionUserFromToken(token?: string | null): Promise<AuthUser | null> {
  const payload = await getSessionPayload(token);
  if (!payload || !payload.email) return null;

  return {
    id: payload.id,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0] || payload.email,
    avatar: payload.avatar || '',
    role: payload.role || 'user',
  };
}

export async function getCurrentUserFromToken(token?: string | null): Promise<AuthUser | null> {
  const payload = await getSessionPayload(token);
  if (!payload) return null;

  try {
    await connectDB();
    const user = (await User.findById(payload.id)
      .select('email name avatar role isVerified')
      .lean()) as LeanAuthUser | null;

    if (!user || !user.email || !user.role) return null;
    if (user.role !== 'admin' && user.isVerified !== true) return null;

    return {
      id: String(user._id),
      email: user.email,
      name: user.name || payload.name || user.email.split('@')[0] || user.email,
      avatar: typeof user.avatar === 'string' ? user.avatar : '',
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return getCurrentUserFromToken(cookieStore.get('token')?.value);
}
