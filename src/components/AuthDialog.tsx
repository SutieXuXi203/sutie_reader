'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';

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

/** Toạ độ (px) đo động cho đầu nhân vật half_head, tính từ mép trên nút Đăng nhập */
interface MascotMetrics {
    hide: number;
    peek: number;
    contact: number;
    burstScale: number;
}

const DEFAULT_MASCOT_METRICS: MascotMetrics = { hide: 90, peek: 62, contact: 54, burstScale: 1.6 };

/** Phải khớp với keyframes mascot-burst trong globals.css (0.9s: 0–36% trồi lên, 36–60% phình to vượt đỉnh) */
const MASCOT_BURST = { riseMs: 324, growMs: 216, overshoot: 1.06 };

/**
 * Hiệu ứng "gãy đôi" (Broken/Cracked in half) cho input khi đầu nhân vật half_head xuyên phá lúc đăng nhập đúng
 */
function BrokenInputWrapper({
    isBroken,
    className,
    children,
    ref,
}: {
    isBroken: boolean;
    className?: string;
    children: React.ReactNode;
    ref?: React.Ref<HTMLDivElement>;
}) {
    return (
        <div ref={ref} className={cn("relative isolate transition-all duration-300", isBroken && "animate-snap-break", className)}>
            {children}
            {isBroken && (
                <>
                    {/* Mảnh vỡ văng ra từ vết nứt */}
                    <Image
                        src="/images_login/shard_1.png"
                        alt=""
                        aria-hidden
                        width={141}
                        height={167}
                        className="absolute left-1/2 top-1/2 w-[14px] h-auto -ml-[7px] -mt-[8px] pointer-events-none z-30 animate-shard-left"
                    />
                    <Image
                        src="/images_login/shard_2.png"
                        alt=""
                        aria-hidden
                        width={195}
                        height={158}
                        className="absolute left-1/2 top-1/2 w-[17px] h-auto -ml-[8px] -mt-[7px] pointer-events-none z-30 animate-shard-right"
                    />
                    {/* Nửa bên trái gãy nghiêng xuống dưới-trái */}
                    <div
                        className="absolute inset-0 pointer-events-none z-10 origin-bottom-left transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                        style={{
                            clipPath: 'polygon(0% 0%, 50% 0%, 48.5% 25%, 50.5% 50%, 48% 75%, 50% 100%, 0% 100%)',
                            transform: 'rotate(-3.5deg) translateY(3.5px) translateX(-2px)'
                        }}
                    >
                        <div className="w-full h-full rounded-[8px] border-2 border-red-500/80 dark:border-red-500/90 bg-red-500/10 dark:bg-red-950/25 shadow-[-2px_4px_12px_rgba(239,68,68,0.25)]" />
                    </div>

                    {/* Nửa bên phải gãy nghiêng xuống dưới-phải */}
                    <div
                        className="absolute inset-0 pointer-events-none z-10 origin-bottom-right transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                        style={{
                            clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%, 48% 75%, 50.5% 50%, 48.5% 25%)',
                            transform: 'rotate(3.5deg) translateY(4px) translateX(2px)'
                        }}
                    >
                        <div className="w-full h-full rounded-[8px] border-2 border-red-500/80 dark:border-red-500/90 bg-red-500/10 dark:bg-red-950/25 shadow-[2px_4px_12px_rgba(239,68,68,0.25)]" />
                    </div>

                    {/* Vết nứt tia sét phát sáng ở trung tâm */}
                    <svg
                        className="absolute left-1/2 top-0 bottom-0 w-[14px] h-full -translate-x-1/2 pointer-events-none z-20 overflow-visible"
                        viewBox="0 0 14 44"
                        preserveAspectRatio="none"
                        fill="none"
                    >
                        <path
                            d="M7 0 L3 11 L10 22 L3 33 L7 44"
                            stroke="#ef4444"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="filter drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                        />
                    </svg>
                </>
            )}
        </div>
    );
}

interface AuthUser {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'guest' | 'user' | 'admin';
}

interface AuthResponse {
    error?: string;
    message?: string;
    user?: AuthUser;
    requireVerification?: boolean;
    requirePin?: boolean;
    email?: string;
}

type ApiError = Error & {
    status?: number;
};

interface AuthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMode?: 'login' | 'register' | 'forgot-password' | 'verify' | 'pin';
}

export function AuthDialog({ open, onOpenChange, initialMode = 'login' }: AuthDialogProps) {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password' | 'verify' | 'pin'>(initialMode);
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
    const [pin, setPin] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [pawsActive, setPawsActive] = useState(false);
    const [brokenFields, setBrokenFields] = useState({ email: false, password: false });
    const [mascotAction, setMascotAction] = useState<'bonk' | 'burst' | null>(null);
    // Tăng mỗi lần kích hoạt để remount đầu nhân vật => animation CSS luôn chạy lại từ đầu
    const [mascotRun, setMascotRun] = useState(0);
    const [mascotMetrics, setMascotMetrics] = useState<MascotMetrics>(DEFAULT_MASCOT_METRICS);
    const [isPasswordBonked, setIsPasswordBonked] = useState(false);
    const pawsTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mascotTimersRef = useRef<NodeJS.Timeout[]>([]);
    const emailFieldRef = useRef<HTMLDivElement>(null);
    const passwordFieldRef = useRef<HTMLDivElement>(null);
    const mascotStageRef = useRef<HTMLDivElement>(null);
    const mascotHeadRef = useRef<HTMLDivElement>(null);
    const isAnyFieldBroken = brokenFields.email || brokenFields.password;

    const triggerPawsAnimation = () => {
        if (pawsTimerRef.current) {
            clearTimeout(pawsTimerRef.current);
        }
        setPawsActive(true);
        // Tự động thu hồi bàn tay sau 1.6 giây
        pawsTimerRef.current = setTimeout(() => {
            setPawsActive(false);
        }, 1600);
    };

    const clearMascotTimers = () => {
        mascotTimersRef.current.forEach(clearTimeout);
        mascotTimersRef.current = [];
    };

    const scheduleMascot = (fn: () => void, delay: number) => {
        mascotTimersRef.current.push(setTimeout(fn, delay));
    };

    const healFields = () => {
        if (isAnyFieldBroken) setBrokenFields({ email: false, password: false });
    };

    /**
     * Đo khoảng cách thực tế giữa mép trên nút Đăng nhập (vạch che đầu nhân vật)
     * với đáy ô Mật khẩu (trần cộc đầu) và đỉnh ô Email (điểm cao nhất khi phá vỡ).
     * Chia cho tỉ lệ scale của hộp thoại để không bị sai lệch khi hộp thoại đang zoom-in.
     */
    const measureMascot = () => {
        const stage = mascotStageRef.current;
        const head = mascotHeadRef.current;
        const passwordField = passwordFieldRef.current;
        const emailField = emailFieldRef.current;
        if (!stage || !head || !passwordField || !emailField || !stage.offsetWidth) return;

        const stageRect = stage.getBoundingClientRect();
        const scale = stageRect.width / stage.offsetWidth || 1;
        const lineY = stageRect.bottom; // mép trên nút Đăng nhập
        const headHeight = head.offsetHeight;
        if (!headHeight) return;

        const ceiling = (lineY - passwordField.getBoundingClientRect().bottom) / scale;
        const emailRect = emailField.getBoundingClientRect();
        const reach = (lineY - emailRect.top) / scale;
        const emailMiddle = (lineY - (emailRect.top + emailRect.bottom) / 2) / scale;

        const next: MascotMetrics = {
            hide: headHeight + 6,
            // Rê chuột: chỉ ló phần sừng/tai, chừa khe hở dưới ô Mật khẩu
            peek: headHeight - Math.max(ceiling - 8, 6),
            // Cộc đầu: đỉnh đầu chạm đúng đáy ô Mật khẩu
            contact: headHeight - Math.max(ceiling, 8),
            // Phá vỡ: đầu ngửa hết lên vượt qua đỉnh ô Email
            burstScale: Math.max(1.2, (reach + 14) / headHeight),
        };
        setMascotMetrics((prev) =>
            prev.hide === next.hide && prev.peek === next.peek && prev.contact === next.contact && prev.burstScale === next.burstScale
                ? prev
                : next
        );
        return { ceiling, emailMiddle, headHeight, burstScale: next.burstScale };
    };

    const triggerHeadBonk = () => {
        clearMascotTimers();
        measureMascot();
        setBrokenFields({ email: false, password: false });
        setIsPasswordBonked(false);
        setMascotAction('bonk');
        setMascotRun((run) => run + 1);
        // Mốc va chạm trùng keyframe 38% của animation mascot-bonk (0.75s)
        scheduleMascot(() => setIsPasswordBonked(true), 285);
        scheduleMascot(() => setIsPasswordBonked(false), 285 + 380);
    };

    const triggerHeadBurst = () => {
        clearMascotTimers();
        const m = measureMascot();
        setIsPasswordBonked(false);
        setMascotAction('burst');
        setMascotRun((run) => run + 1);
        // Đầu lao từ dưới lên: xuyên ô Mật khẩu trước, sau đó tới ô Email.
        // Thời điểm vỡ tính theo vị trí đỉnh đầu trong 2 đoạn tuyến tính của keyframes mascot-burst.
        let passwordAt = 150;
        let emailAt = 420;
        if (m) {
            const h = m.headHeight;
            const peakTop = h * m.burstScale * MASCOT_BURST.overshoot;
            const crossAt = (y: number) =>
                y <= h
                    ? MASCOT_BURST.riseMs * ((y + 6) / (h + 6))
                    : MASCOT_BURST.riseMs + MASCOT_BURST.growMs * Math.min(1, (y - h) / Math.max(peakTop - h, 1));
            passwordAt = crossAt(m.ceiling + 6);
            emailAt = Math.max(passwordAt + 80, crossAt(m.emailMiddle));
        }
        scheduleMascot(() => setBrokenFields((f) => ({ ...f, password: true })), Math.round(passwordAt));
        scheduleMascot(() => setBrokenFields({ email: true, password: true }), Math.round(emailAt));
    };

    const resetState = () => {
        if (pawsTimerRef.current) {
            clearTimeout(pawsTimerRef.current);
            pawsTimerRef.current = null;
        }
        clearMascotTimers();
        setError('');
        setSuccess('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        setName('');
        setVerificationCode('');
        setPin('');
        setPawsActive(false);
        setBrokenFields({ email: false, password: false });
        setMascotAction(null);
        setIsPasswordBonked(false);
    };

    // Đổi chế độ (login/register/...) => xoá trạng thái nhân vật & ô vỡ ngay trong lúc render
    const [mascotMode, setMascotMode] = useState(mode);
    if (mascotMode !== mode) {
        setMascotMode(mode);
        setBrokenFields({ email: false, password: false });
        setMascotAction(null);
        setIsPasswordBonked(false);
    }
    // Huỷ các mốc hẹn giờ còn treo của chế độ cũ (cleanup chạy khi mode đổi)
    useEffect(() => clearMascotTimers, [mode]);

    // Đo lại vị trí trần/đỉnh cho đầu nhân vật khi mở hộp thoại, đổi chế độ hoặc đổi kích thước cửa sổ
    useEffect(() => {
        if (!open || mode !== 'login') return;
        const frame = requestAnimationFrame(() => measureMascot());
        // Ảnh đầu nhân vật có thể tải xong sau lần đo đầu => theo dõi kích thước để đo lại
        const observer = new ResizeObserver(() => measureMascot());
        if (mascotHeadRef.current) observer.observe(mascotHeadRef.current);
        if (mascotStageRef.current) observer.observe(mascotStageRef.current);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [open, mode, error, mascotRun]);

    useEffect(() => clearMascotTimers, []);

    useEffect(() => {
        if (open) {
            setMode(initialMode);
            resetState();
        }
    }, [open, initialMode]);

    const handleSubmit = async (e?: React.FormEvent, overridePin?: string, overrideCode?: string) => {
        if (e) e.preventDefault();

        // Kiểm tra hợp lệ khi đăng nhập: nếu chưa nhập tài khoản/mật khẩu, nhân vật cộc đầu vào ô mật khẩu rồi nhún xuống
        if (mode === 'login') {
            if (!email.trim()) {
                triggerHeadBonk();
                setError('Vui lòng nhập tài khoản hoặc email.');
                return;
            }
            if (!password) {
                triggerHeadBonk();
                setError('Vui lòng nhập mật khẩu.');
                return;
            }
            triggerPawsAnimation();
        }

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            let url = '/api/auth/login';
            let payload = {};

            if (mode === 'login' || mode === 'pin') {
                const currentPin = overridePin !== undefined ? overridePin : pin;
                url = '/api/auth/login';
                payload = { email, password, rememberMe, pin: mode === 'pin' ? currentPin : undefined };
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
                const currentCode = overrideCode !== undefined ? overrideCode : verificationCode;
                url = '/api/auth/verify';
                payload = { email, code: currentCode };
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

            if (data.requirePin) {
                setMode('pin');
                setSuccess(data.message || 'Vui lòng nhập mã PIN bảo mật để hoàn tất đăng nhập');
                setIsLoading(false);
                setTimeout(() => {
                    document.getElementById('pin-input-0')?.focus();
                }, 100);
                return;
            }

            if (mode === 'login' || mode === 'pin') {
                if (!data.user) {
                    throw new Error('Thiếu dữ liệu người dùng từ máy chủ');
                }
                if (mode === 'login') {
                    triggerHeadBurst();
                    // Đợi chuyển động ngửa hết lên và phá vỡ 2 ô input diễn ra trọn vẹn
                    await new Promise((resolve) => setTimeout(resolve, 1250));
                }
                notify.success(data.message || 'Đăng nhập thành công');
                login(data.user);
                onOpenChange(false);
                router.refresh();
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
            if (mode === 'login') {
                triggerHeadBonk();
            }
            if (apiError.status === 403) {
                notify.warning(
                    'Tài khoản chưa xác thực',
                    'Vui lòng kiểm tra email và nhập mã xác thực trước khi đăng nhập.'
                );
                setMode('verify');
            } else if (apiError.status === 410) {
                notify.error(
                    'Tài khoản đã bị xóa tự động',
                    'Mã xác thực đã hết hạn. Vui lòng đăng ký lại.'
                );
                setMode('register');
            }
            setError(message);
            setTimeout(() => setPawsActive(false), 800);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            disablePointerDismissal={true}
            onOpenChange={(val, eventDetails) => {
                if (!val && eventDetails?.reason === 'outside-press') {
                    return;
                }
                onOpenChange(val);
                if (!val) resetState();
            }}
        >
            <DialogContent
                showCloseButton={false}
                overlayClassName="bg-white/95 dark:bg-black/75 backdrop-blur-md"
                topActions={
                    <div className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50">
                        <ThemeToggle
                            variant="ghost"
                            className="border-0 ring-0 shadow-none bg-transparent hover:bg-transparent dark:hover:bg-transparent active:bg-transparent dark:active:bg-transparent text-foreground cursor-pointer"
                        />
                    </div>
                }
                className="sm:max-w-md max-h-[90vh] sm:max-h-[85vh] p-4 sm:p-6 overflow-y-auto overscroll-contain custom-scrollbar bg-transparent border-0 ring-0 shadow-none"
            >
                <DialogHeader className="mb-1 sm:mb-2">
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-center text-foreground mb-1 sm:mb-2">
                        {mode === 'login' && 'Chào mừng trở lại'}
                        {mode === 'register' && 'Tạo tài khoản mới'}
                        {mode === 'forgot-password' && 'Khôi phục mật khẩu'}
                        {mode === 'verify' && 'Xác thực tài khoản'}
                        {mode === 'pin' && 'Mã PIN bảo mật'}
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm text-center text-neutral-600 dark:text-neutral-100">
                        {mode === 'login' && 'Đăng nhập để tiếp tục trải nghiệm của bạn'}
                        {mode === 'register' && ''}
                        {mode === 'forgot-password' && 'Nhập email để nhận liên kết đặt lại mật khẩu'}
                        {mode === 'verify' && 'Nhập mã gồm 6 chữ số được gửi đến email của bạn'}
                        {mode === 'pin' && 'Tài khoản yêu cầu mã PIN bảo mật để hoàn tất đăng nhập'}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <p className="text-sm font-medium text-red-500 dark:text-red-400 text-center animate-in fade-in-0 duration-200">
                        {error}
                    </p>
                )}

                {success && (
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 text-center animate-in fade-in-0 duration-200">
                        {success}
                    </p>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-4">
                    {mode === 'register' && (
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Họ và tên"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="pl-10 bg-white/80 dark:bg-transparent shadow-xs"
                                required
                            />
                        </div>
                    )}

                    {mode !== 'pin' && mode !== 'verify' && (
                        <BrokenInputWrapper ref={emailFieldRef} isBroken={brokenFields.email && mode === 'login'}>
                            <Mail
                                className={cn(
                                    "absolute left-3 top-3 h-4 w-4 text-neutral-400 transition-all duration-300",
                                    brokenFields.email && mode === 'login' && "text-red-500 dark:text-red-400 transform -rotate-3 translate-y-0.5"
                                )}
                            />
                            <Input
                                type="text"
                                placeholder="Email hoặc tên đăng nhập"
                                value={email}
                                onFocus={healFields}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    healFields();
                                    if (pawsActive) setPawsActive(false);
                                }}
                                className={cn(
                                    "pl-10 bg-white/80 dark:bg-transparent shadow-xs transition-colors",
                                    brokenFields.email && mode === 'login' && "border-transparent text-red-500 dark:text-red-400 placeholder:text-red-400/70"
                                )}
                                required
                            />
                        </BrokenInputWrapper>
                    )}

                    {mode !== 'forgot-password' && mode !== 'verify' && mode !== 'pin' && (
                        <div className="space-y-4">
                            <BrokenInputWrapper
                                ref={passwordFieldRef}
                                isBroken={brokenFields.password && mode === 'login'}
                                className={isPasswordBonked ? "animate-field-bonked" : undefined}
                            >
                                <Lock
                                    className={cn(
                                        "absolute left-3 top-3 h-4 w-4 text-neutral-400 transition-all duration-300",
                                        brokenFields.password && mode === 'login' && "text-red-500 dark:text-red-400 transform -rotate-3 translate-y-0.5"
                                    )}
                                />
                                <Input
                                    type={showPassword && password.length > 0 ? 'text' : 'password'}
                                    placeholder="Mật khẩu"
                                    value={password}
                                    onFocus={healFields}
                                    onChange={(e) => {
                                        const nextPassword = e.target.value;
                                        setPassword(nextPassword);
                                        if (!nextPassword) setShowPassword(false);
                                        healFields();
                                        if (pawsActive) setPawsActive(false);
                                    }}
                                    className={cn(
                                        "pl-10 pr-10 bg-white/80 dark:bg-transparent shadow-xs transition-colors",
                                        brokenFields.password && mode === 'login' && "border-transparent text-red-500 dark:text-red-400 placeholder:text-red-400/70"
                                    )}
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
                            </BrokenInputWrapper>

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
                                        className="pl-10 pr-10 bg-white/80 dark:bg-transparent shadow-xs"
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
                                            } else if (finalCode.length === 6) {
                                                setTimeout(() => {
                                                    handleSubmit(undefined, undefined, finalCode);
                                                }, 50);
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
                                                if (pastedData.length === 6) {
                                                    setTimeout(() => {
                                                        handleSubmit(undefined, undefined, pastedData);
                                                    }, 50);
                                                }
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

                    {mode === 'pin' && (
                        <div className="flex flex-col gap-3 items-center w-full">
                            <span className="text-sm text-neutral-500 font-medium">Nhập mã PIN 6 chữ số</span>
                            <div className="flex gap-2 sm:gap-3 justify-center w-full">
                                {[...Array(6)].map((_, index) => (
                                    <input
                                        key={index}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        value={pin[index] || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (!/^[0-9]*$/.test(value)) return;
                                            const newPin = pin.split('');
                                            newPin[index] = value;
                                            const finalPin = newPin.join('');
                                            setPin(finalPin);
                                            if (value && index < 5) {
                                                const nextInput = document.getElementById(`pin-input-${index + 1}`);
                                                nextInput?.focus();
                                            } else if (finalPin.length === 6) {
                                                setTimeout(() => {
                                                    handleSubmit(undefined, finalPin);
                                                }, 50);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !pin[index] && index > 0) {
                                                const prevInput = document.getElementById(`pin-input-${index - 1}`);
                                                prevInput?.focus();
                                            }
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault();
                                            const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
                                            if (pastedData) {
                                                setPin(pastedData);
                                                const nextFocusIndex = Math.min(pastedData.length, 5);
                                                document.getElementById(`pin-input-${nextFocusIndex}`)?.focus();
                                                if (pastedData.length === 6) {
                                                    setTimeout(() => {
                                                        handleSubmit(undefined, pastedData);
                                                    }, 50);
                                                }
                                            }
                                        }}
                                        id={`pin-input-${index}`}
                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold bg-white dark:bg-secondary border-2 border-border/50 rounded-[8px] focus:outline-none focus:border-primary dark:focus:border-primary transition-colors shadow-sm text-foreground"
                                        required={index === 0}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {mode === 'login' && (
                        <div className="flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setMode('forgot-password')}
                                className="text-xs text-neutral-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors"
                            >
                                Quên mật khẩu?
                            </button>
                        </div>
                    )}

                    <div className="relative group" onPointerEnter={mode === 'login' ? () => measureMascot() : undefined}>
                        {mode === 'login' && (
                            <>
                                {/*
                                  Sân khấu của đầu nhân vật half_head: đáy sân khấu trùng mép trên nút Đăng nhập
                                  và bị cắt (clip-path) tại đó => đầu trông như trồi lên từ phía sau/dưới nút.
                                */}
                                <div
                                    ref={mascotStageRef}
                                    aria-hidden
                                    className="mascot-stage absolute inset-x-0 bottom-full h-[260px] pointer-events-none select-none z-10"
                                    style={{
                                        '--mascot-hide': `${mascotMetrics.hide}px`,
                                        '--mascot-peek': `${mascotMetrics.peek}px`,
                                        '--mascot-contact': `${mascotMetrics.contact}px`,
                                        '--mascot-burst-scale': mascotMetrics.burstScale,
                                    } as React.CSSProperties}
                                >
                                    <div
                                        key={mascotRun}
                                        ref={mascotHeadRef}
                                        onAnimationEnd={(event) => {
                                            if (event.animationName === 'mascot-bonk') setMascotAction(null);
                                        }}
                                        className={cn(
                                            "mascot-head absolute bottom-0 inset-x-0 mx-auto w-[130px] sm:w-[150px]",
                                            mascotAction === 'bonk' && "animate-mascot-bonk",
                                            mascotAction === 'burst' && "animate-mascot-burst",
                                            !mascotAction && "mascot-head-idle",
                                            pawsActive && !mascotAction && "mascot-head-peek"
                                        )}
                                    >
                                        <Image
                                            src="/images_login/half_head_trimmed.png"
                                            alt=""
                                            width={1476}
                                            height={811}
                                            className="w-full h-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
                                            draggable={false}
                                            priority
                                        />
                                    </div>

                                    {/* Vệt rung "CỘC!" hai bên đỉnh đầu khi va vào đáy ô Mật khẩu */}
                                    {isPasswordBonked && (
                                        <div
                                            className="absolute inset-x-0 mx-auto w-[150px] sm:w-[170px]"
                                            style={{ bottom: `${Math.max(mascotMetrics.hide - 6 - mascotMetrics.contact - 22, 0)}px` }}
                                        >
                                            <Image
                                                src="/images_login/impact_wave_1.png"
                                                alt=""
                                                width={89}
                                                height={142}
                                                className="absolute left-0 bottom-0 w-[11px] h-auto animate-impact-wave-left"
                                            />
                                            <Image
                                                src="/images_login/impact_wave_2.png"
                                                alt=""
                                                width={85}
                                                height={130}
                                                className="absolute right-0 bottom-0 w-[11px] h-auto animate-impact-wave-right"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Đôi bàn tay mèo đặt ở mép trên của nút đăng nhập */}
                                <div className="absolute -top-[14px] sm:-top-[16px] left-1/2 -translate-x-1/2 pointer-events-none select-none z-20">
                                    <div
                                        className={cn(
                                            "w-[110px] sm:w-[130px] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                                            "opacity-0 -translate-y-3.5 scale-90",
                                            "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
                                            pawsActive && "opacity-100 translate-y-0 scale-100"
                                        )}
                                    >
                                        <Image
                                            src="/images_login/cat_two_paws.png"
                                            alt="Đôi bàn tay mèo bám nút đăng nhập"
                                            width={647}
                                            height={136}
                                            className="w-full h-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                                            priority
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        <Button
                            type="submit"
                            onClick={() => {
                                if (mode === 'login' && email.trim() && password) {
                                    triggerPawsAnimation();
                                }
                            }}
                            disabled={isLoading || (mode === 'pin' && pin.length !== 6) || (mode === 'verify' && verificationCode.length !== 6)}
                            className="rounded-[8px] w-full shadow-lg h-9 sm:h-10 text-sm font-medium"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {mode === 'login' && 'Đăng nhập'}
                                    {mode === 'register' && 'Đăng ký'}
                                    {mode === 'forgot-password' && 'Gửi liên kết'}
                                    {mode === 'verify' && 'Xác thực'}
                                    {mode === 'pin' && 'Xác nhận mã PIN'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>

                <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-neutral-500 dark:text-neutral-300">
                    {mode === 'login' && (
                        <p>
                            Chưa có tài khoản?{' '}
                            <button onClick={() => setMode('register')} className="text-primary font-semibold hover:underline decoration-2">
                                Đăng ký ngay
                            </button>
                        </p>
                    )}
                    {mode === 'pin' && (
                        <p>
                            Muốn đăng nhập tài khoản khác?{' '}
                            <button type="button" onClick={() => { setMode('login'); setPin(''); }} className="text-primary font-semibold hover:underline decoration-2">
                                Quay lại
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
