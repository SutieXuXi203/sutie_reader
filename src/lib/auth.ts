import { NextRequest } from 'next/server';

import { getCurrentUserFromToken, getSessionUserFromToken, type AuthUser } from '@/lib/server-auth';

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;

    return getCurrentUserFromToken(token);
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
    const user = await getAuthUser(request);
    return user?.role === 'admin';
}
