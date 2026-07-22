'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import { notify } from '@/lib/notify';

const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
};

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Đã có lỗi xảy ra';

interface AuthUser {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'user' | 'admin';
}

interface AuthResponse {
    error?: string;
    message?: string;
    user?: AuthUser;
    requireVerification?: boolean;
    email?: string;
}

type ApiError = Error & {
    status?: number;
};

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMode?: 'login' | 'register' | 'forgot-password' | 'verify';
}

export function AuthDialog({ open, onOpenChange, initialMode = 'login' }: AuthDialogProps) {
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password' | 'verify'>(initialMode);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [name, setName] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [rememberMe, setRememberMe] = useState(true);

    const resetState = () => {
        setError('');
        setSuccess('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        setName('');
        setVerificationCode('');
    };

    useEffect(() => {
        if (open) {
            setMode(initialMode);
            resetState();
        }
    }, [open, initialMode]);

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
                if (password !== confirmPassword) {
                    setError('Mật khẩu xác nhận không khớp.');
                    setIsLoading(false);
                    return;
                }

                const strength = getPasswordStrength(password);
                if (strength < 2) {
                    setError('Mật khẩu quá yếu. Vui lòng bao gồm chữ hoa, chữ thường và số.');
                    setIsLoading(false);
                    return;
                }

                url = '/api/auth/register';
                payload = { email, password, name };
            } else if (mode === 'verify') {
                url = '/api/auth/verify';
                payload = { email, code: verificationCode };
            } else if (mode === 'forgot-password') {
                setSuccess('Hướng dẫn khôi phục mật khẩu đã được gửi đến email của bạn.');
                setIsLoading(false);
                return;
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data: AuthResponse = await res.json();
            if (!res.ok) {
                const apiError = new Error(data.error || 'Đã có lỗi xảy ra') as ApiError;
                apiError.status = res.status;
                throw apiError;
            }

            if (mode === 'login') {
                if (!data.user) {
                    throw new Error('Thiếu dữ liệu người dùng từ máy chủ');
                }
                notify.success(data.message || 'Đăng nhập thành công');
                login(data.user);
                onOpenChange(false);
            } else if (mode === 'register') {
                notify.success(
                    data.requireVerification
                        ? 'Vui lòng kiểm tra email của bạn để lấy mã xác thực.'
                        : 'Đăng ký thành công'
                );
                if (data.requireVerification) {
                    setMode('verify');
                } else {
                    setMode('login');
                }
            } else if (mode === 'verify') {
                setSuccess('Xác thực thành công! Vui lòng đăng nhập.');
                setMode('login');
            }
        } catch (err: unknown) {
            const apiError = err as ApiError;
            const message = getErrorMessage(apiError);
            if (apiError.status === 403) {
                notify.warning(
                    'Tài khoản chưa xác thực',
                    'Vui lòng kiểm tra email và nhập mã xác thực trước khi đăng nhập.'
                );
            } else if (apiError.status === 410) {
                notify.error(
                    'Tài khoản đã bị xóa tự động',
                    'Mã xác thực đã hết hạn sau 24 giờ. Vui lòng đăng ký lại.'
                );
            }
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetState(); }}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto overscroll-contain custom-scrollbar bg-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center text-foreground mb-2">
                        {mode === 'login' && 'Chào mừng trở lại'}
                        {mode === 'register' && 'Tạo tài khoản mới'}
                        {mode === 'forgot-password' && 'Khôi phục mật khẩu'}
                        {mode === 'verify' && 'Xác thực tài khoản'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-neutral-500 dark:text-neutral-100">
                        {mode === 'login' && 'Đăng nhập để tiếp tục trải nghiệm của bạn'}
                        {mode === 'register' && 'Tham gia cộng đồng và chia sẻ ý tưởng của bạn'}
                        {mode === 'forgot-password' && 'Nhập email để nhận liên kết đặt lại mật khẩu'}
                        {mode === 'verify' && 'Nhập mã gồm 6 chữ số được gửi đến email của bạn'}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="bg-secondary text-primary p-3 rounded-[8px] text-sm font-medium border border-border">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-[8px] text-sm font-medium border border-green-100 dark:border-green-900/30">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {mode === 'register' && (
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
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
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                        <Input
                            type="text"
                            placeholder="Email hoặc tên đăng nhập"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10"
                            required
                        />
                    </div>

                    {mode !== 'forgot-password' && mode !== 'verify' && (
                        <div className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                                <Input
                                    type={showPassword && password.length > 0 ? 'text' : 'password'}
                                    placeholder="Mật khẩu"
                                    value={password}
                                    onChange={(e) => {
                                        const nextPassword = e.target.value;
                                        setPassword(nextPassword);
                                        if (!nextPassword) setShowPassword(false);
                                    }}
                                    className="pl-10 pr-10"
                                    required
                                />
                                {password.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((current) => !current)}
                                        onMouseDown={(event) => event.preventDefault()}
                                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-neutral-400 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                        aria-pressed={showPassword}
                                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                )}
                            </div>

                            {mode === 'register' && password.length > 0 && (
                                <div className="space-y-1.5 px-1">
                                    <div className="flex gap-1.5 h-1.5">
                                        {[1, 2, 3, 4].map((level) => {
                                            const strength = getPasswordStrength(password);
                                            let bgColor = 'bg-red-100 dark:bg-red-900/30';
                                            if (strength >= level) {
                                                if (strength === 1) bgColor = 'bg-red-500';
                                                else if (strength === 2) bgColor = 'bg-orange-500';
                                                else if (strength === 3) bgColor = 'bg-yellow-500';
                                                else if (strength === 4) bgColor = 'bg-emerald-500';
                                            }
                                            return (
                                                <div
                                                    key={level}
                                                    className={`flex-1 rounded-[8px] transition-colors duration-300 ${bgColor}`}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="text-[11px] font-medium text-right text-neutral-500 dark:text-neutral-400">
                                        {getPasswordStrength(password) === 0 && 'Rất yếu'}
                                        {getPasswordStrength(password) === 1 && 'Yếu'}
                                        {getPasswordStrength(password) === 2 && 'Trung bình'}
                                        {getPasswordStrength(password) === 3 && 'Khá'}
                                        {getPasswordStrength(password) === 4 && 'Mạnh'}
                                    </div>
                                </div>
                            )}

                            {mode === 'register' && (
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                                    <Input
                                        type={showConfirmPassword && confirmPassword.length > 0 ? 'text' : 'password'}
                                        placeholder="Xác nhận mật khẩu"
                                        value={confirmPassword}
                                        onChange={(e) => {
                                            const nextConfirmPassword = e.target.value;
                                            setConfirmPassword(nextConfirmPassword);
                                            if (!nextConfirmPassword) setShowConfirmPassword(false);
                                        }}
                                        className="pl-10 pr-10"
                                        required
                                    />
                                    {confirmPassword.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((current) => !current)}
                                            onMouseDown={(event) => event.preventDefault()}
                                            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-neutral-400 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                            aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                                            aria-pressed={showConfirmPassword}
                                            title={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'verify' && (
                        <div className="flex flex-col gap-3 items-center w-full">
                            <span className="text-sm text-neutral-500 font-medium">Nhập mã 6 chữ số</span>
                            <div className="flex gap-2 sm:gap-3 justify-center w-full">
                                {[...Array(6)].map((_, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        maxLength={1}
                                        value={verificationCode[index] || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (!/^[0-9]*$/.test(value)) return;
                                            const newCode = verificationCode.split('');
                                            newCode[index] = value;
                                            const finalCode = newCode.join('');
                                            setVerificationCode(finalCode);
                                            if (value && index < 5) {
                                                const nextInput = document.getElementById(`otp-${index + 1}`);
                                                nextInput?.focus();
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
                                                const prevInput = document.getElementById(`otp-${index - 1}`);
                                                prevInput?.focus();
                                            }
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault();
                                            const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
                                            if (pastedData) {
                                                setVerificationCode(pastedData);
                                                const nextFocusIndex = Math.min(pastedData.length, 5);
                                                document.getElementById(`otp-${nextFocusIndex}`)?.focus();
                                            }
                                        }}
                                        id={`otp-${index}`}
                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-white dark:bg-secondary border-2 border-border/50 rounded-[8px] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors shadow-sm text-foreground"
                                        required={index === 0}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === 'login' && (
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded-[8px] border-neutral-300 dark:border-neutral-600 text-foreground focus:ring-primary accent-black dark:accent-white hover:cursor-pointer"
                                />
                                <span className="text-xs text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-800 dark:group-hover:text-neutral-100 transition-colors">
                                    Ghi nhớ đăng nhập
                                </span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setMode('forgot-password')}
                                className="text-xs text-neutral-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors"
                            >
                                Quên mật khẩu?
                            </button>
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="rounded-[8px] w-full shadow-lg"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                {mode === 'login' && 'Đăng nhập'}
                                {mode === 'register' && 'Đăng ký'}
                                {mode === 'forgot-password' && 'Gửi liên kết'}
                                {mode === 'verify' && 'Xác thực'}
                            </>
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-300">
                    {mode === 'login' && (
                        <p>
                            Chưa có tài khoản?{' '}
                            <button onClick={() => setMode('register')} className="text-primary font-semibold hover:underline decoration-2">
                                Đăng ký ngay
                            </button>
                        </p>
                    )}
                    {(mode === 'register' || mode === 'forgot-password' || mode === 'verify') && (
                        <p>
                            Đã có tài khoản?{' '}
                            <button type="button" onClick={() => setMode('login')} className="text-primary font-semibold hover:underline decoration-2">
                                Đăng nhập
                            </button>
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
