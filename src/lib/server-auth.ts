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

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters'
);

type LeanAuthUser = {
  _id: unknown;
  email?: string;
  name?: string;
  avatar?: string;
  role?: 'user' | 'admin';
};

type SessionPayload = {
  id: string;
  email: string;
  role: 'user' | 'admin';
};

async function getSessionPayload(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const id = typeof payload.id === 'string' ? payload.id : null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const role = payload.role === 'admin' || payload.role === 'user' ? payload.role : null;

    if (!id || !email || !role) return null;

    return { id, email, role };
  } catch {
    return null;
  }
}

export async function getSessionUserFromToken(token?: string | null): Promise<AuthUser | null> {
  const payload = await getSessionPayload(token);
  if (!payload) return null;

  return {
    id: payload.id,
    email: payload.email,
    name: payload.email.split('@')[0] || payload.email,
    avatar: '',
    role: payload.role,
  };
}

export async function getCurrentUserFromToken(token?: string | null): Promise<AuthUser | null> {
  const payload = await getSessionPayload(token);
  if (!payload) return null;

  try {
    await connectDB();
    const user = (await User.findById(payload.id)
      .select('email name avatar role')
      .lean()) as LeanAuthUser | null;

    if (!user || !user.email || !user.name || !user.role) return null;

    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      avatar: typeof user.avatar === 'string' ? user.avatar : '',
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return getSessionUserFromToken(cookieStore.get('token')?.value);
}
