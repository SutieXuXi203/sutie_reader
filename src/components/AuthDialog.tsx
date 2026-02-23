'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, User, Loader2, Key } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMode?: 'login' | 'register' | 'forgot-password';
}

export function AuthDialog({ open, onOpenChange, initialMode = 'login' }: AuthDialogProps) {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { login } = useAuth();

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [rememberMe, setRememberMe] = useState(true);

    const resetState = () => {
        setError('');
        setSuccess('');
        setEmail('');
        setPassword('');
        setName('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            let url = '/api/auth/login';
            let payload = {};

            if (mode === 'login') {
                url = '/api/auth/login';
                payload = { email, password, rememberMe };
            } else if (mode === 'register') {
                url = '/api/auth/register';
                payload = { email, password, name };
            } else if (mode === 'forgot-password') {
                // Simple mock for forgot password
                setSuccess('Hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.');
                setIsLoading(false);
                return;
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Đã có lỗi xảy ra');
            }

            if (mode === 'login') {
                login(data.user);
                onOpenChange(false);
            } else if (mode === 'register') {
                setSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
                setMode('login');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetState(); }}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
                        {mode === 'login' && 'Chào mừng trở lại'}
                        {mode === 'register' && 'Tạo tài khoản mới'}
                        {mode === 'forgot-password' && 'Khôi phục mật khẩu'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-500 dark:text-slate-400">
                        {mode === 'login' && 'Đăng nhập để tiếp tục viết câu chuyện của bạn'}
                        {mode === 'register' && 'Tham gia cộng đồng và chia sẻ ý tưởng của bạn'}
                        {mode === 'forgot-password' && 'Nhập email để nhận liên kết đặt lại mật khẩu'}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-none text-sm font-medium border border-red-100 dark:border-red-900/30">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-none text-sm font-medium border border-green-100 dark:border-green-900/30">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {mode === 'register' && (
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Họ và tên"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="pl-10"
                                required
                            />
                        </div>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Email hoặc tên đăng nhập"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10"
                            required
                        />
                    </div>

                    {mode !== 'forgot-password' && (
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                type="password"
                                placeholder="Mật khẩu"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-10"
                                required
                            />
                        </div>
                    )}

                    {mode === 'login' && (
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded-none border-slate-300 dark:border-slate-700 text-slate-900 focus:ring-slate-500 accent-slate-900 dark:accent-slate-100"
                                />
                                <span className="text-xs text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Ghi nhớ đăng nhập</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setMode('forgot-password')}
                                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            >
                                Quên mật khẩu?
                            </button>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="rounded-none w-full shadow-lg"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                {mode === 'login' && 'Đăng nhập'}
                                {mode === 'register' && 'Đăng ký'}
                                {mode === 'forgot-password' && 'Gửi liên kết'}
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    {mode === 'login' && (
                        <p>
                            Chưa có tài khoản?{' '}
                            <button onClick={() => setMode('register')} className="text-slate-900 dark:text-white font-semibold hover:underline decoration-2">
                                Đăng ký ngay
                            </button>
                        </p>
                    )}
                    {(mode === 'register' || mode === 'forgot-password') && (
                        <p>
                            Đã có tài khoản?{' '}
                            <button onClick={() => setMode('login')} className="text-slate-900 dark:text-white font-semibold hover:underline decoration-2">
                                Đăng nhập
                            </button>
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    );
}
