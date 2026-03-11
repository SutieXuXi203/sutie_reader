'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { notify } from '@/lib/notify';
interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'user' | 'admin';
}
interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (userData: User) => void;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    isAdmin: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to check auth', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);
    const login = useCallback((userData: User) => {
        setUser(userData);
    }, []);
    const logout = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                setUser(null);
                notify.success('Đăng xuất thành công');
            } else {
                notify.error('Đăng xuất không thành công');
            }
        } catch (error) {
            console.error('Logout failed', error);
            notify.error('Đã xảy ra lỗi khi đăng xuất');
        }
    }, []);
    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth, isAdmin: user?.role === 'admin' }}>
            {children}
        </AuthContext.Provider>
    );
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
