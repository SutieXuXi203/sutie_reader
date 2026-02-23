import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-fallback-secret-key-at-least-32-characters');

export async function getAuthUser(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value;
        if (!token) return null;

        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as { id: string; email: string; role: 'user' | 'admin' };
    } catch (error) {
        return null;
    }
}

export async function isAdmin(request: NextRequest) {
    const user = await getAuthUser(request);
    return user?.role === 'admin';
}
