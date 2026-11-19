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
}

const DEFAULT_MASCOT_METRICS: MascotMetrics = { hide: 90, peek: 62, contact: 54 };

/**
 * Phải khớp keyframes mascot-burst trong globals.css (1.1s): 0–20% lùi xuống, 20–32% lấy đà,
 * 32–44% bật thẳng lên (tuyến tính) => riseStartMs = 352, riseMs = 132.
 */
const MASCOT_BURST = { riseStartMs: 352, riseMs: 132, topImpactMs: 60 };

/** Thời gian giữ hộp thoại để hiệu ứng phá vỡ diễn ra trọn vẹn trước khi đóng / sang bước PIN */
const MASCOT_BURST_HOLD_MS = 1450;

/** Phải khớp keyframes mascot-bonk (0.8s, va chạm ở 30%) và field-bonked (0.5s) trong globals.css */
const MASCOT_BONK = { impactMs: 240, shakeMs: 520, durationMs: 800 };

/** Thời gian đầu nhân vật trốn hẳn sau nút sau khi cộc đầu, trước khi tự ló lên lại */
const MASCOT_REAPPEAR_DELAY_MS = 600;

/** Hai nửa ô input bị gãy (cắt theo đường nứt zigzag ở giữa) */
const SHATTER_HALVES = [
    {
        side: 'left',
        clipPath: 'polygon(0% 0%, 50% 0%, 48.5% 25%, 50.5% 50%, 48% 75%, 50% 100%, 0% 100%)',
        animation: 'animate-shatter-left',
    },
    {
        side: 'right',
        clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%, 48% 75%, 50.5% 50%, 48.5% 25%)',
        animation: 'animate-shatter-right',
    },
] as const;

/**
 * Mảnh vỡ của chính ô input (vẽ bằng SVG, cùng chất liệu nền + viền đỏ với 2 nửa gãy).
 * points: đa giác trong hộp 0–20; size: px; dx/up/dy: bắn ngang, vồng lên rồi rơi xuống (px); rot: độ xoay.
 */
const SHATTER_SHARDS = [
    { points: '2,1 19,4 11,19', size: 13, dx: -78, up: -34, dy: 46, rot: -280, dur: 0.75, delay: 0 },
    { points: '1,6 14,1 19,15 6,19', size: 11, dx: 86, up: -30, dy: 52, rot: 310, dur: 0.8, delay: 0.02 },
    { points: '3,2 18,8 8,18', size: 9, dx: -42, up: -48, dy: 30, rot: -200, dur: 0.7, delay: 0.04 },
    { points: '2,10 10,1 19,12 9,19', size: 8, dx: 50, up: -52, dy: 26, rot: 230, dur: 0.72, delay: 0.03 },
    { points: '1,1 19,7 4,17', size: 7, dx: -104, up: -14, dy: 60, rot: -340, dur: 0.85, delay: 0.05 },
    { points: '4,1 19,10 1,19', size: 6, dx: 112, up: -18, dy: 64, rot: 360, dur: 0.88, delay: 0.06 },
] as const;

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
        <div ref={ref} className={cn("relative isolate", isBroken && "animate-snap-break", className)}>
            {/* Ô input thật: ẩn ngay khi bị phá (vẫn giữ chỗ để bố cục không xô lệch), hiện lại khi tự chữa lành */}
            <div className={cn("relative transition-opacity", isBroken ? "opacity-0 duration-75" : "opacity-100 duration-300")}>
                {children}
            </div>
            {isBroken && (
                <div aria-hidden className="absolute inset-0 pointer-events-none">
                    {/* Hai nửa ô input bị đánh gãy: giật mạnh sang hai bên rồi văng xuống và biến mất */}
                    {SHATTER_HALVES.map((half) => (
                        <div
                            key={half.side}
                            className={cn("absolute inset-0 z-10", half.animation)}
                            style={{ clipPath: half.clipPath }}
                        >
                            <div className="w-full h-full rounded-md border-2 border-red-500/80 dark:border-red-500/90 bg-white/80 dark:bg-red-950/30 shadow-[0_6px_16px_rgba(239,68,68,0.35)]" />
                        </div>
                    ))}

                    {/* Mảnh vỡ của ô input bắn ra từ vết nứt, vồng lên rồi rơi xuống, xoay tròn */}
                    {SHATTER_SHARDS.map((shard) => (
                        <svg
                            key={shard.points + shard.dx}
                            viewBox="0 0 20 20"
                            width={shard.size}
                            height={shard.size}
                            className="absolute left-1/2 top-1/2 z-30 overflow-visible animate-shard-fly"
                            style={{
                                '--shard-dx': `${shard.dx}px`,
                                '--shard-up': `${shard.up}px`,
                                '--shard-dy': `${shard.dy}px`,
                                '--shard-rot': `${shard.rot}deg`,
                                animationDuration: `${shard.dur}s`,
                                animationDelay: `${shard.delay}s`,
                            } as React.CSSProperties}
                        >
                            <polygon
                                points={shard.points}
                                strokeWidth="2"
                                strokeLinejoin="round"
                                className="fill-white dark:fill-red-950 stroke-red-500"
                            />
                        </svg>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Tia nhấn mạnh hình tam giác cho mỗi bên: đỉnh nhọn hướng vào điểm va chạm, đáy rộng toả ra ngoài.
 * angle: hướng tia (độ, trục y hướng xuống: 180 = trái, 270 = lên, 360 = phải); from/to: khoảng cách
 * từ điểm va chạm; width: nửa bề rộng đáy. Hai bên cố ý khác nhau (3 tia / 2 tia) như nét vẽ tay.
 */
const IMPACT_RAYS = {
    left: [
        { angle: 194, from: 6, to: 28, width: 6 },
        { angle: 229, from: 7, to: 37, width: 8.5 },
        { angle: 263, from: 9, to: 25, width: 4.5 },
    ],
    right: [
        { angle: 288, from: 8, to: 30, width: 6.5 },
        { angle: 329, from: 6, to: 33, width: 7.5 },
    ],
} as const;

/**
 * Hiệu ứng "CỘC!" khi đầu nhân vật đập vào ô Mật khẩu: chùm tia vàng nhạt viền cam bung ra từ
 * điểm va chạm. Điểm va chạm là góc dưới phía trong của SVG (bên trái: góc dưới-phải, bên phải: góc dưới-trái).
 */
function ImpactBurst({ side, className }: { side: 'left' | 'right'; className?: string }) {
    const size = 40;
    const focus = { x: side === 'left' ? size : 0, y: size };
    const rays = IMPACT_RAYS[side].map(({ angle, from, to, width }) => {
        const rad = (angle * Math.PI) / 180;
        const dir = { x: Math.cos(rad), y: Math.sin(rad) };
        const perp = { x: -dir.y, y: dir.x };
        const tip = { x: focus.x + dir.x * from, y: focus.y + dir.y * from };
        const base = { x: focus.x + dir.x * to, y: focus.y + dir.y * to };
        const tipHalf = width * 0.18;
        return [
            [tip.x + perp.x * tipHalf, tip.y + perp.y * tipHalf],
            [base.x + perp.x * width, base.y + perp.y * width],
            [base.x - perp.x * width, base.y - perp.y * width],
            [tip.x - perp.x * tipHalf, tip.y - perp.y * tipHalf],
        ]
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join(' ');
    });

    return (
        <svg
            aria-hidden
            viewBox={`0 0 ${size} ${size}`}
            className={cn(
                "w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] overflow-visible animate-impact-pop",
                side === 'left' ? "origin-bottom-right" : "origin-bottom-left [animation-delay:45ms]",
                className
            )}
        >
            {rays.map((points) => (
                <polygon
                    key={points}
                    points={points}
                    fill="#FCE38A"
                    stroke="#F5A524"
                    strokeWidth="2.6"
                    strokeLinejoin="round"
                />
            ))}
        </svg>
    );
}

/**
 * 100 câu chào ngẫu nhiên khi rê chuột vào nút Đăng nhập. Bong bóng này mọc sang phải từ đỉnh đầu nên
 * mỗi câu tối đa 13 ký tự để không tràn khung (kể cả trên điện thoại).
 */
const HOVER_CHATS = [
    'Hey!', 'Hello!', 'Chào nha!', 'Hí hí!', 'Ê ê!',
    'Hế lô!', 'Yo!', 'Hi hi ^^', 'Bấm đi!', 'Bấm nè!',
    'Vào thôi!', 'Đi nào!', 'Lẹ lên nè!', 'Chờ gì nữa?', 'Ơ kìa!',
    'Ủa alo?', 'Alo alo!', 'Ping!', 'Boo!', 'Ú òa!',
    'Bắt được rồi!', 'Hehe :3', 'Ngày đẹp ha!', 'Xin chào!', 'Nhớ bạn ghê!',
    'Lâu quá ta!', 'Ê bạn ơi!', 'Bạn đó hả?', 'Tới rồi nè!', 'Nhấn vô đi!',
    'Click đi!', 'Gâu... meo!', 'Meo meo!', 'Meo~', 'Rừ rừ...',
    'Nhìn gì đó?', 'Gì dợ?', 'Hihi!', 'Ơ, bạn kìa!', 'Chơi không?',
    'Đọc hông nè?', 'Chương mới nè', 'Hóng quá đi!', 'Cố lên!', 'Fighting!',
    'Tuyệt vời!', 'Đỉnh nóc!', 'Xịn xò!', 'Quá dữ!', 'Oke la!',
    "Let's go!", 'Go go go!', 'Vô đi bạn!', 'Bấm cái nhẹ~', 'Chọt mình hả?',
    'Nhột quá!', 'Á, nhột!', 'Đừng chọt!', 'Hứ!', 'Hờn rồi nha!',
    'Đùa thôi :D', 'Yêu bạn!', 'Thương ghê!', 'Cưng xỉu!', 'Dễ thương ha!',
    'Bạn xinh ghê!', 'Hello bạn!', 'Mình ở đây!', 'Thấy mình hơm', 'Cúc cu!',
    'Hù!', 'Bùm!', 'Tèn ten!', 'Ta-da!', 'Wow!',
    'Ồ la la!', 'Ui da!', 'Ơ hay!', 'Ừm hửm?', 'Gì nè?',
    'Sẵn sàng chưa', 'Lên đường!', 'Xuất phát!', 'Đi đọc thôi!', 'Có mình nè!',
    'Khỏe hông?', 'Ăn cơm chưa?', 'Ngủ đủ chưa?', 'Uống nước đi!', 'Nghỉ xíu nha!',
    'Đợi bạn mãi!', 'Tới rồi hả!', 'Hí lô!', 'Chào xìn xò!', 'Hú hú!',
    'Kìa kìa!', 'Ghé chơi hả?', 'Quẹo lựa!', 'Ố dề!', 'Moshi moshi!',
] as const;

/** 20 câu nhân vật nói ngẫu nhiên khi người dùng đang nhập Email (giữ ngắn để vừa bong bóng trên điện thoại) */
const EMAIL_CHATS = [
    'Bạn đang nhập Email à ?',
    'Email đẹp ghê đó nha!',
    'Gõ từ từ thôi, mình đợi ^^',
    'Nhớ gõ đúng chính tả nha~',
    'Có chữ @ chưa đó bạn?',
    'Mình đang nhìn nè :3',
    'Hôm nay đọc truyện gì đây?',
    'Ủa, gõ nhanh dữ vậy!',
    'Email này nghe quen quen...',
    'Cố lên, sắp xong rồi!',
    'Mình hóng bạn vào lắm đó',
    'Xong rồi nhập mật khẩu nha',
    'Bạn gõ phím êm ghê ^^',
    'Chương mới ra rồi đó!',
    'Đừng gõ nhầm .con nha :v',
    'Hehe, mình thấy hết rồi',
    'Tên đăng nhập cũng được nha',
    'Bạn quay lại rồi! Vui quá',
    'Từ từ, mình chưa đọc kịp',
    'Nhập xong là vào đọc liền!',
] as const;

/** 20 câu nhân vật nói ngẫu nhiên khi người dùng đang nhập Mật khẩu (nhân vật đang trốn, không nhìn trộm) */
const PASSWORD_CHATS = [
    'Bạn nhập đi mình trốn đây !! :3',
    'Mình nhắm mắt rồi nè, gõ đi~',
    'Không nhìn đâu, thề đó!',
    'Mình trốn kỹ lắm rồi nha',
    'Mật khẩu là bí mật nha ^^',
    'Gõ đi, mình bịt mắt rồi',
    'Tay mình che mắt rồi nè :3',
    'Nhớ đừng dùng 123456 nha',
    'Có chữ hoa chưa đó bạn?',
    'Suỵt... mình không thấy gì',
    'Mình đếm tới 10 rồi ra nha',
    'Đừng để ai nhìn trộm nha!',
    'Gõ xong gọi mình dậy nha',
    'Mình ngủ một xíu đây zzz',
    'Mật khẩu mạnh là đỉnh nhất!',
    'Bạn nhớ mật khẩu chứ hả?',
    'Mình trốn sau nút nè hihi',
    'Gõ cẩn thận kẻo sai nha~',
    'Xong là vào đọc truyện liền!',
    'Không nhìn, không nhìn :3',
] as const;

/**
 * Gợi ý khi đăng nhập sai nhiều lần. API cố ý trả cùng một lỗi 401 cho "sai mật khẩu" và "không có tài khoản"
 * (chống dò tài khoản - SECURITY_RULES), nên nhân vật gợi ý luân phiên cả hai hướng và làm nhấp nháy link tương ứng.
 */
const HINT_CHATS = {
    forgot: [
        'Quên mật khẩu rồi hả bạn?',
        'Thử "Quên mật khẩu?" xem nha',
        'Sai hoài, lấy lại mật khẩu đi~',
        'Kiểm tra Caps Lock giúp mình nha',
        'Mật khẩu khó nhớ ghê ha :<',
    ],
    register: [
        'Bạn có tài khoản chưa nhỉ?',
        'Chưa có tài khoản? Đăng ký nè!',
        'Đăng ký ngay, mình đợi nè ^^',
        'Email này đăng ký chưa ta?',
        'Tạo tài khoản mới đi bạn ơi',
    ],
    /** Bị khoá tạm vì sai quá nhiều (429): chỉ gợi ý chờ hoặc lấy lại mật khẩu */
    locked: [
        'Khoá tạm rồi, nghỉ xíu nha :<',
        'Hay bấm "Quên mật khẩu?" nhé',
        'Đợi chút rồi thử lại nha bạn',
    ],
} as const;

/** Từ lần sai thứ mấy (liên tiếp) thì nhân vật bắt đầu gợi ý */
const HINT_AFTER_FAILS = 2;

/** Đang nhập lâu thì cứ mỗi khoảng này nhân vật đổi sang câu khác */
const CHAT_ROTATE_MS = 4500;

/** Bốc ngẫu nhiên một câu khác câu vừa nói */
const pickChat = (count: number, previous: number) => {
    const next = Math.floor(Math.random() * (count - 1));
    return next >= previous ? next + 1 : next;
};

/**
 * Câu thoại ngẫu nhiên cho một ô nhập: reroll() bốc câu mới (gọi khi người dùng bấm vào ô),
 * và trong lúc active thì tự đổi câu sau mỗi CHAT_ROTATE_MS.
 */
function useRotatingChat(lines: readonly string[], active: boolean) {
    const [index, setIndex] = useState(0);
    const reroll = () => setIndex((current) => pickChat(lines.length, current));

    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setIndex((current) => pickChat(lines.length, current)), CHAT_ROTATE_MS);
        return () => clearInterval(timer);
    }, [active, lines.length]);

    return { index, text: lines[index % lines.length], reroll };
}

/** Tốc độ gõ chữ trong bong bóng thoại (ms/ký tự) và độ trễ trước ký tự đầu (chờ bong bóng bật ra) */
const TYPEWRITER = { charMs: 38, startDelayMs: 140 };

/**
 * Chữ hiện dần như đang gõ, kèm con trỏ nhấp nháy. Giữ sẵn bề rộng của cả câu (bản vô hình) để bong bóng
 * không giãn ra trong lúc gõ. Mỗi lần bong bóng được dựng lại thì gõ lại từ đầu.
 * prefers-reduced-motion: hiện đủ câu ngay.
 */
function TypewriterText({ text }: { text: string }) {
    const chars = Array.from(text);
    const [count, setCount] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? chars.length : 0
    );
    const isDone = count >= chars.length;

    useEffect(() => {
        if (isDone) return;
        const timer = setTimeout(
            () => setCount((current) => current + 1),
            count === 0 ? TYPEWRITER.startDelayMs : TYPEWRITER.charMs
        );
        return () => clearTimeout(timer);
    }, [count, isDone]);

    return (
        <span className="relative inline-block">
            <span className="invisible">{text}</span>
            <span className="absolute inset-0">
                {chars.slice(0, count).join('')}
                <span className={cn("mascot-caret", isDone && "mascot-caret-done")} />
            </span>
        </span>
    );
}

/**
 * Bong bóng thoại của nhân vật (kiểu truyện tranh: nền trắng, viền đen, bóng đổ cứng), đuôi chỉ về nhân vật.
 * Bong bóng chỉ được dựng khi cần hiện: bật nảy ra rồi gõ chữ.
 * anchor:
 *  - 'head': mọc sang phải từ đỉnh đầu (câu ngắn, vd "Hey!").
 *  - 'head-right': canh mép phải khung, ngay trên góc phải đầu đang ló (không che mặt nhân vật).
 *  - 'paws': căn giữa đúng trục đôi tay (điện thoại: canh trái), đuôi chỉ xuống bàn tay trái (lúc đầu đang trốn).
 *    Cần khối cha là container (@container) vì đuôi được đặt theo đơn vị cqw.
 */
function MascotBubble({
    text,
    anchor = 'head',
    className,
    style,
}: {
    text: string;
    anchor?: 'head' | 'head-right' | 'paws';
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <div
            role="status"
            className={cn(
                "mascot-bubble absolute z-30 pointer-events-none select-none",
                "rounded-2xl border-2 border-neutral-900 bg-white px-3 py-1 font-extrabold text-neutral-900 shadow-[2px_3px_0_rgba(0,0,0,0.85)]",
                anchor === 'head' && "left-1/2",
                anchor === 'head-right' && "mascot-bubble-head-right right-0",
                // Điện thoại: canh trái để không đè "Quên mật khẩu?"; từ sm: căn giữa đúng trục đôi tay
                // Điện thoại: bề rộng tối thiểu phủ qua bàn tay trái để câu ngắn vẫn chứa trọn đuôi
                anchor === 'paws' &&
                    "mascot-bubble-paws left-0 min-w-[calc(50cqw-4px)] text-center sm:left-1/2 sm:min-w-0 sm:-translate-x-1/2",
                className
            )}
            style={style}
        >
            <TypewriterText text={text} />
            {/* Đuôi bong bóng: miếng nền trắng phủ lên đoạn viền đáy để đuôi liền với bong bóng (không có gạch ngang) */}
            <svg
                aria-hidden
                className={cn(
                    "absolute -bottom-[11px] w-[14px] h-[12px] overflow-visible",
                    // Điện thoại (bong bóng canh trái): 50cqw = tâm khối nút. Từ sm (bong bóng căn giữa): 50% = tâm bong bóng = tâm khối nút
                    anchor === 'paws' ? "left-[calc(50cqw-31px)] sm:left-[calc(50%-36px)]" : "left-[10px]"
                )}
                viewBox="0 0 14 12"
            >
                <path d="M1.2 -2.2 H12.8 V0.4 L3 11 L1.2 0.4 Z" className="fill-white" />
                <path d="M1 0 L3 11 L13 0" fill="none" className="stroke-neutral-900" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
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
    // Sau khi cộc đầu: thụt xuống biến mất rồi tự ló lên lại (không cần rê chuột) cho tới lần tương tác sau
    const [mascotPeek, setMascotPeek] = useState(false);
    // Đang gõ ô Email: nhân vật ló lên xem cùng đôi tay bám mép nút
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    // Đang gõ ô Mật khẩu: nhân vật trốn hẳn xuống (chỉ còn đôi tay) để không "nhìn trộm" mật khẩu
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    // Số lần đăng nhập sai liên tiếp (401) và cờ bị khoá tạm (429) => nhân vật gợi ý Quên mật khẩu / Đăng ký
    const [loginFailCount, setLoginFailCount] = useState(0);
    const [isLoginLocked, setIsLoginLocked] = useState(false);
    const [isHintDismissed, setIsHintDismissed] = useState(false);
    // Gợi ý sau khi sai nhiều lần: hiện khi nhân vật đã ló lên lại sau cú cộc, ưu tiên hơn các câu khi đang nhập
    // (người dùng hay bấm Enter ngay trong ô Mật khẩu) cho tới khi người dùng gõ tiếp vào một ô.
    const hintTarget: 'forgot' | 'register' =
        isLoginLocked || loginFailCount % 2 === 0 ? 'forgot' : 'register';
    const isHintVisible =
        mode === 'login' &&
        (isLoginLocked || loginFailCount >= HINT_AFTER_FAILS) &&
        !isHintDismissed &&
        mascotPeek &&
        !mascotAction;
    const isMascotHiding = !mascotAction && !isHintVisible && isPasswordFocused && mode === 'login';
    const isMascotPeeking =
        !mascotAction && !isMascotHiding && (pawsActive || mascotPeek || (isEmailFocused && mode === 'login'));
    const isEmailPeeking = !mascotAction && !isHintVisible && isEmailFocused && mode === 'login';
    // Đang nhập Email / Mật khẩu: nhân vật nói câu ngẫu nhiên và đổi câu sau vài giây
    const emailChat = useRotatingChat(EMAIL_CHATS, isEmailPeeking);
    const passwordChat = useRotatingChat(PASSWORD_CHATS, isMascotHiding);
    const hintChat = useRotatingChat(
        isLoginLocked ? HINT_CHATS.locked : HINT_CHATS[hintTarget],
        isHintVisible
    );
    const hoverChat = useRotatingChat(HOVER_CHATS, isButtonHovered && !mascotAction && !isHintVisible);
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
        const emailMiddle = (lineY - (emailRect.top + emailRect.bottom) / 2) / scale;

        const next: MascotMetrics = {
            hide: headHeight + 6,
            // Rê chuột: chỉ ló phần sừng/tai, chừa khe hở dưới ô Mật khẩu
            peek: headHeight - Math.max(ceiling - 8, 6),
            // Cộc đầu: đỉnh đầu chạm đúng đáy ô Mật khẩu
            contact: headHeight - Math.max(ceiling, 8),
        };
        setMascotMetrics((prev) =>
            prev.hide === next.hide && prev.peek === next.peek && prev.contact === next.contact
                ? prev
                : next
        );
        return { ceiling, emailMiddle, headHeight };
    };

    const triggerHeadBonk = () => {
        clearMascotTimers();
        measureMascot();
        setBrokenFields({ email: false, password: false });
        setIsPasswordBonked(false);
        setMascotPeek(false);
        setMascotAction('bonk');
        setMascotRun((run) => run + 1);
        // Mốc va chạm trùng keyframe 30% của animation mascot-bonk (0.8s)
        scheduleMascot(() => setIsPasswordBonked(true), MASCOT_BONK.impactMs);
        scheduleMascot(() => setIsPasswordBonked(false), MASCOT_BONK.impactMs + MASCOT_BONK.shakeMs);
        // Hết cú cộc (đầu đã trốn hẳn sau nút) => chờ một nhịp rồi tự ló lên lại.
        // Dùng hẹn giờ thay vì animationend để không bị kẹt khi trình duyệt không phát sự kiện đó.
        scheduleMascot(() => setMascotAction(null), MASCOT_BONK.durationMs);
        scheduleMascot(() => setMascotPeek(true), MASCOT_BONK.durationMs + MASCOT_REAPPEAR_DELAY_MS);
    };

    const triggerHeadBurst = () => {
        clearMascotTimers();
        const m = measureMascot();
        setIsPasswordBonked(false);
        setMascotPeek(false);
        setMascotAction('burst');
        setMascotRun((run) => run + 1);
        // Đầu lùi xuống lấy đà rồi bật thẳng lên: xuyên ô Mật khẩu trước, ô Email vỡ ngay sau.
        // Thời điểm vỡ tính theo vị trí đỉnh đầu trong đoạn bật lên tuyến tính của keyframes mascot-burst;
        // nếu đầu không với tới ô Email thì ô Email vỡ do dư chấn ngay khi đầu bật lên hết.
        let passwordAt = MASCOT_BURST.riseStartMs + MASCOT_BURST.riseMs * 0.6;
        let emailAt = MASCOT_BURST.riseStartMs + MASCOT_BURST.riseMs + MASCOT_BURST.topImpactMs;
        if (m) {
            const h = m.headHeight;
            const crossAt = (y: number) =>
                MASCOT_BURST.riseStartMs +
                (y <= h ? MASCOT_BURST.riseMs * ((y + 6) / (h + 6)) : MASCOT_BURST.riseMs + MASCOT_BURST.topImpactMs);
            passwordAt = crossAt(m.ceiling + 6);
            emailAt = Math.max(passwordAt + 90, crossAt(m.emailMiddle));
        }
        scheduleMascot(() => setBrokenFields((f) => ({ ...f, password: true })), Math.round(passwordAt));
        scheduleMascot(() => setBrokenFields({ email: true, password: true }), Math.round(emailAt));
    };

    /**
     * Người dùng tự chuyển màn (Quên mật khẩu / Đăng ký / Quay lại / Đăng nhập): xoá thông báo của màn cũ
     * và mã PIN đang nhập dở. Chuyển màn do máy chủ trả về (sang PIN, xác thực xong) vẫn dùng setMode để giữ thông báo.
     */
    const switchMode = (nextMode: typeof mode) => {
        setError('');
        setSuccess('');
        setPin('');
        setMode(nextMode);
    };

    const resetState = () => {
        setLoginFailCount(0);
        setIsLoginLocked(false);
        setIsHintDismissed(false);
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
        setMascotPeek(false);
        setIsPasswordBonked(false);
    };

    // Đổi chế độ (login/register/...) => xoá trạng thái nhân vật & ô vỡ ngay trong lúc render
    const [mascotMode, setMascotMode] = useState(mode);
    if (mascotMode !== mode) {
        setMascotMode(mode);
        setBrokenFields({ email: false, password: false });
        setMascotAction(null);
        setMascotPeek(false);
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
                // Máy chủ chỉ yêu cầu PIN khi mật khẩu đã đúng => vẫn phát hiệu ứng phá vỡ 2 ô input trước khi sang bước PIN
                if (mode === 'login') {
                    triggerHeadBurst();
                    await new Promise((resolve) => setTimeout(resolve, MASCOT_BURST_HOLD_MS));
                }
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
                    await new Promise((resolve) => setTimeout(resolve, MASCOT_BURST_HOLD_MS));
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
                if (apiError.status === 401 || apiError.status === 429) {
                    if (apiError.status === 401) setLoginFailCount((count) => count + 1);
                    else setIsLoginLocked(true);
                    setIsHintDismissed(false);
                    hintChat.reroll();
                }
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
                className={cn(
                    "sm:max-w-md max-h-[90vh] sm:max-h-[85vh] p-4 sm:p-6 overscroll-contain no-scrollbar bg-transparent border-0 ring-0 shadow-none",
                    // Khi linh vật cộc đầu / phá vỡ ô input, đầu và mảnh vỡ bay ra ngoài khung:
                    // để tràn tự do thay vì tạo vùng cuộn (không cắt hình, không bật thanh cuộn)
                    mascotAction || isAnyFieldBroken ? "overflow-visible" : "overflow-y-auto"
                )}
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
                        <BrokenInputWrapper
                            ref={emailFieldRef}
                            isBroken={brokenFields.email && mode === 'login'}
                            className={isPasswordBonked ? "animate-field-aftershock" : undefined}
                        >
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
                                onFocus={() => {
                                    healFields();
                                    setIsEmailFocused(true);
                                    emailChat.reroll();
                                }}
                                onBlur={() => setIsEmailFocused(false)}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setIsHintDismissed(true);
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
                                    onFocus={() => {
                                        healFields();
                                        setIsPasswordFocused(true);
                                        passwordChat.reroll();
                                    }}
                                    onBlur={() => setIsPasswordFocused(false)}
                                    onChange={(e) => {
                                        const nextPassword = e.target.value;
                                        setPassword(nextPassword);
                                        setIsHintDismissed(true);
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
                                        // Tab sang nút hiện/ẩn mật khẩu vẫn tính là đang nhập mật khẩu => nhân vật tiếp tục trốn
                                        onFocus={() => setIsPasswordFocused(true)}
                                        onBlur={() => setIsPasswordFocused(false)}
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
                                onClick={() => switchMode('forgot-password')}
                                className={cn(
                                    "text-xs text-neutral-600 dark:text-neutral-300 hover:text-primary dark:hover:text-primary transition-colors",
                                    isHintVisible && hintTarget === 'forgot' && "mascot-hint-pulse"
                                )}
                            >
                                Quên mật khẩu?
                            </button>
                        </div>
                    )}

                    {/* Chế độ PIN không có nút: mã tự gửi khi nhập/dán đủ 6 số, chỉ hiện vòng xoay khi đang xác minh */}
                    {mode === 'pin' && isLoading && (
                        <div className="flex justify-center" role="status" aria-label="Đang xác minh mã PIN">
                            <Loader2 className="w-5 h-5 animate-spin text-neutral-500 dark:text-neutral-300" />
                        </div>
                    )}

                    {mode !== 'pin' && (
                        <div
                            className="relative group @container"
                            onPointerEnter={(event) => {
                                if (mode !== 'login') return;
                                measureMascot();
                                // Chỉ chuột thật mới "rê" được; chạm trên điện thoại không bật bong bóng Hey!
                                if (event.pointerType !== 'mouse') return;
                                setIsButtonHovered(true);
                                hoverChat.reroll();
                            }}
                            onPointerLeave={() => setIsButtonHovered(false)}
                        >
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
                                        } as React.CSSProperties}
                                    >
                                        <div
                                            key={mascotRun}
                                            ref={mascotHeadRef}
                                            className={cn(
                                                "mascot-head absolute bottom-0 inset-x-0 mx-auto w-[130px] sm:w-[150px]",
                                                mascotAction === 'bonk' && "animate-mascot-bonk",
                                                mascotAction === 'burst' && "animate-mascot-burst",
                                                !mascotAction && "mascot-head-idle",
                                                isMascotPeeking && "mascot-head-peek",
                                                isMascotHiding && "mascot-head-hiding"
                                            )}
                                        >
                                            <Image
                                                src="/images_login/half_head_2_trimmed.png"
                                                alt=""
                                                width={1486}
                                                height={842}
                                                sizes="(min-width: 640px) 150px, 130px"
                                                className="w-full h-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
                                                draggable={false}
                                                priority
                                            />
                                        </div>

                                        {/* Tia "CỘC!" vàng viền cam bung ra hai bên đỉnh đầu, ngay tại điểm va vào đáy ô Mật khẩu */}
                                        {isPasswordBonked && (
                                            <div
                                                className="absolute inset-x-0 mx-auto w-[124px] sm:w-[144px]"
                                                style={{ bottom: `${Math.max(mascotMetrics.hide - 6 - mascotMetrics.contact - 4, 0)}px` }}
                                            >
                                                <ImpactBurst side="left" className="absolute left-0 bottom-0" />
                                                <ImpactBurst side="right" className="absolute right-0 bottom-0" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Bong bóng chào ngẫu nhiên ("Hey!"...) bật ra cạnh đầu nhân vật khi rê chuột vào nút (ẩn khi đang cộc / bật phá / nhập mật khẩu) */}
                                    {/* Sai nhiều lần: gợi ý Quên mật khẩu / Đăng ký (link tương ứng nhấp nháy) */}
                                    {isHintVisible && (
                                        <MascotBubble
                                            key={`${hintTarget}-${hintChat.index}`}
                                            text={hintChat.text}
                                            anchor="head-right"
                                            className="whitespace-nowrap py-0.5 text-[11px] sm:text-xs leading-snug"
                                            style={{ bottom: `calc(100% + ${Math.max(mascotMetrics.hide - 6 - mascotMetrics.peek + 10, 18)}px)` }}
                                        />
                                    )}

                                    {isButtonHovered && !mascotAction && !isMascotHiding && !isEmailPeeking && !isHintVisible && (
                                        <MascotBubble
                                            key={hoverChat.index}
                                            text={hoverChat.text}
                                            className="ml-[34px] sm:ml-[40px] whitespace-nowrap text-xs sm:text-sm tracking-wide"
                                            style={{ bottom: `calc(100% + ${Math.max(mascotMetrics.hide - 6 - mascotMetrics.peek - 6, 10)}px)` }}
                                        />
                                    )}

                                    {/* Đang nhập mật khẩu: đầu trốn hẳn, bong bóng nói chuyện ngay trên đôi tay */}
                                    {isMascotHiding && (
                                        <MascotBubble
                                            key={passwordChat.index}
                                            text={passwordChat.text}
                                            anchor="paws"
                                            className="whitespace-nowrap px-2.5 py-0.5 text-[11px] leading-snug"
                                            style={{ bottom: 'calc(100% + 17px)' }}
                                        />
                                    )}

                                    {/* Đang nhập Email: đầu ló lên xem, bong bóng hỏi ở góc trên bên phải đầu */}
                                    {isEmailPeeking && (
                                        <MascotBubble
                                            key={emailChat.index}
                                            text={emailChat.text}
                                            anchor="head-right"
                                            className="whitespace-nowrap py-0.5 text-[11px] sm:text-xs leading-snug"
                                            // Đáy bong bóng = đáy ô Mật khẩu + 2px (ceiling = hide - 6 - peek + 8) => luôn nằm trên hàng "Quên mật khẩu?"
                                            style={{ bottom: `calc(100% + ${Math.max(mascotMetrics.hide - 6 - mascotMetrics.peek + 10, 18)}px)` }}
                                        />
                                    )}

                                    {/* Đôi bàn tay mèo đặt ở mép trên của nút đăng nhập */}
                                    <div className="absolute -top-[14px] sm:-top-[16px] left-1/2 -translate-x-1/2 pointer-events-none select-none z-20">
                                        <div
                                            className={cn(
                                                "w-[110px] sm:w-[130px] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                                                "opacity-0 -translate-y-3.5 scale-90",
                                                "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
                                                // Khi bật phá ô: đầu lùi xuống nhưng đôi tay vẫn bám mép nút
                                                (isMascotPeeking || isMascotHiding || mascotAction === 'burst') && "opacity-100 translate-y-0 scale-100"
                                            )}
                                        >
                                            <Image
                                                src="/images_login/cat_two_paws.png"
                                                alt="Đôi bàn tay mèo bám nút đăng nhập"
                                                width={647}
                                                height={136}
                                                sizes="(min-width: 640px) 130px, 110px"
                                                className={cn(
                                                    "w-full h-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
                                                    mascotAction === 'burst' && "animate-paws-brace"
                                                )}
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
                                disabled={isLoading || (mode === 'verify' && verificationCode.length !== 6)}
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
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </form>

                <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-neutral-500 dark:text-neutral-300">
                    {mode === 'login' && (
                        <p>
                            Chưa có tài khoản?{' '}
                            <button
                                type="button"
                                onClick={() => switchMode('register')}
                                className={cn(
                                    "text-primary font-semibold hover:underline decoration-2",
                                    isHintVisible && hintTarget === 'register' && "mascot-hint-pulse"
                                )}
                            >
                                Đăng ký ngay
                            </button>
                        </p>
                    )}
                    {mode === 'pin' && (
                        <p>
                            Muốn đăng nhập tài khoản khác?{' '}
                            <button type="button" onClick={() => switchMode('login')} className="text-primary font-semibold hover:underline decoration-2">
                                Quay lại
                            </button>
                        </p>
                    )}
                    {(mode === 'register' || mode === 'forgot-password' || mode === 'verify') && (
                        <p>
                            Đã có tài khoản?{' '}
                            <button type="button" onClick={() => switchMode('login')} className="text-primary font-semibold hover:underline decoration-2">
                                Đăng nhập
                            </button>
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
