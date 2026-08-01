import { NextRequest } from 'next/server';

import { getCurrentUserFromToken, type AuthUser } from '@/lib/server-auth';

export async function getAuthUser(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    if (!token) return null;

    return getCurrentUserFromToken(token) as Promise<AuthUser | null>;
}
export async function isAdmin(request: NextRequest) {
    const user = await getAuthUser(request);
    return user?.role === 'admin';
}
