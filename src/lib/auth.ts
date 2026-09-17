import { NextRequest } from 'next/server';

import { getCurrentUserFromToken, getSessionUserFromToken, type AuthUser } from '@/lib/server-auth';

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;

    return getCurrentUserFromToken(token);
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
    const token = request.cookies.get('token')?.value;
    if (!token) return false;

    // Fast-path: Check verified JWT signature directly (0ms DB latency)
    const sessionUser = await getSessionUserFromToken(token);
    if (sessionUser?.role === 'admin') {
        return true;
    }

    const user = await getAuthUser(request);
    return user?.role === 'admin';
}
