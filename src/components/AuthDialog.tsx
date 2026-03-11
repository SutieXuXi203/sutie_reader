'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, User, Loader2, Key } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
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
    const [name, setName] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const resetState = () => {
        setError('');
        setSuccess('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
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
                    setError('M?t kh?u x�c nh?n kh�ng kh?p.');
                    setIsLoading(false);
                    return;
                }
                const strength = getPasswordStrength(password);
                if (strength < 2) {
                    setError('M?t kh?u qu� y?u. Vui l�ng bao g?m ch? hoa, ch? th??ng v� s?.');
                    setIsLoading(false);
                    return;
                }
                url = '/api/auth/register';
                payload = { email, password, name };
            } else if (mode === 'verify') {
                url = '/api/auth/verify';
                payload = { email, code: verificationCode };
            } else if (mode === 'forgot-password') {
                setSuccess('H??ng d?n kh�i ph?c m?t kh?u ?� ???c g?i ??n email c?a b?n.');
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
                throw new Error(data.error || '?� c� l?i x?y ra');
            }
            if (mode === 'login') {
                login(data.user);
                onOpenChange(false);
            } else if (mode === 'register') {
                if (data.requireVerification) {
                    setSuccess('Vui l�ng ki?m tra email c?a b?n ?? l?y m� x�c th?c.');
                    setMode('verify');
                } else {
                    setSuccess('??ng k� th�nh c�ng! Vui l�ng ??ng nh?p.');
                    setMode('login');
                }
            } else if (mode === 'verify') {
                setSuccess('X�c th?c th�nh c�ng! Vui l�ng ??ng nh?p.');
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
            <DialogContent className="sm:max-w-md bg-white dark:bg-[#1a0808] border-red-200 dark:border-red-900/30">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-100 mb-2">
                        {mode === 'login' && 'Ch�o m?ng tr? l?i'}
                        {mode === 'register' && 'T?o t�i kho?n m?i'}
                        {mode === 'forgot-password' && 'Kh�i ph?c m?t kh?u'}
                        {mode === 'verify' && 'X�c th?c t�i kho?n'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-neutral-500 dark:text-neutral-400">
                        {mode === 'login' && '??ng nh?p ?? ti?p t?c vi?t c�u chuy?n c?a b?n'}
                        {mode === 'register' && 'Tham gia c?ng ??ng v� chia s? � t??ng c?a b?n'}
                        {mode === 'forgot-password' && 'Nh?p email ?? nh?n li�n k?t ??t l?i m?t kh?u'}
                        {mode === 'verify' && 'Nh?p m� g?m 6 ch? s? ???c g?i ??n email c?a b?n'}
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
                                placeholder="H? v� t�n"
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
                            placeholder="Email ho?c t�n ??ng nh?p"
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
                                    type="password"
                                    placeholder="M?t kh?u"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    required
                                />
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
                                        {getPasswordStrength(password) === 0 && 'R?t y?u'}
                                        {getPasswordStrength(password) === 1 && 'Y?u'}
                                        {getPasswordStrength(password) === 2 && 'Trung b�nh'}
                                        {getPasswordStrength(password) === 3 && 'Kh�'}
                                        {getPasswordStrength(password) === 4 && 'M?nh'}
                                    </div>
                                </div>
                            )}
                            {mode === 'register' && (
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                                    <Input
                                        type="password"
                                        placeholder="X�c nh?n m?t kh?u"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {mode === 'verify' && (
                        <div className="flex flex-col gap-3 items-center w-full">
                            <span className="text-sm text-neutral-500 font-medium">Nh?p m� 6 ch? s?</span>
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
                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-white dark:bg-[#1a0808] border-2 border-border/50 rounded-[8px] focus:outline-none focus:border-primary dark:focus:border-red-400 transition-colors shadow-sm text-neutral-900 dark:text-neutral-100"
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
                                    className="w-4 h-4 rounded-[8px] border-red-300 dark:border-red-700 text-red-600 focus:ring-primary accent-red-600 dark:accent-red-400"
                                />
                                <span className="text-xs text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors">Ghi nh? ??ng nh?p</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setMode('forgot-password')}
                                className="text-xs text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                                Qu�n m?t kh?u?
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
                                {mode === 'login' && '??ng nh?p'}
                                {mode === 'register' && '??ng k�'}
                                {mode === 'forgot-password' && 'G?i li�n k?t'}
                                {mode === 'verify' && 'X�c th?c'}
                            </>
                        )}
                    </Button>
                </form>
                <div className="mt-6 text-center text-sm text-neutral-500">
                    {mode === 'login' && (
                        <p>
                            Ch?a c� t�i kho?n?{' '}
                            <button onClick={() => setMode('register')} className="text-primary font-semibold hover:underline decoration-2">
                                ??ng k� ngay
                            </button>
                        </p>
                    )}
                    {(mode === 'register' || mode === 'forgot-password' || mode === 'verify') && (
                        <p>
                            ?� c� t�i kho?n?{' '}
                            <button type="button" onClick={() => setMode('login')} className="text-primary font-semibold hover:underline decoration-2">
                                ??ng nh?p
                            </button>
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    );
}

