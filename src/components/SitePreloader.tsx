'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/providers/AuthContext';
import { usePreloader } from '@/providers/PreloaderContext';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SakugaProgressBar } from '@/components/SakugaProgressBar';

const STICKER_FRAMES = [
  '/images_welcome/sticker_vuive.png',
  '/images_welcome/sticker_vuivehanhphuc.png',
];
const BUBBLE_IMAGE = '/bubblechat_images/bubble_chat.png';

export function SitePreloader() {
  const { isLoading: isAuthLoading } = useAuth();
  const { finishPreloader } = usePreloader();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const [frameIndex, setFrameIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Kích hoạt bong bóng chat xuất hiện sau đúng 1 giây
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBubble(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 1. Tải trước (preload) cả ảnh sticker và bubble chat vào bộ nhớ đệm
  useEffect(() => {
    [...STICKER_FRAMES, BUBBLE_IMAGE].forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  // 2. Chuyển đổi khung hình chậm rãi, êm dịu (750ms mỗi ảnh)
  useEffect(() => {
    if (!isMounted) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev === 0 ? 1 : 0));
    }, 750);
    return () => clearInterval(interval);
  }, [isMounted]);

  // 3. Khóa cuộn trang khi preloader đang hiển thị
  useEffect(() => {
    if (isMounted && !isFading) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMounted, isFading]);

  // 4. Theo dõi tiến trình tải tài nguyên, font, auth và window load
  useEffect(() => {
    let windowLoaded = typeof document !== 'undefined' && document.readyState === 'complete';
    let fontsLoaded = false;

    const checkWindowLoad = () => {
      windowLoaded = true;
    };

    if (!windowLoaded) {
      window.addEventListener('load', checkWindowLoad);
    }

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready
        .then(() => {
          fontsLoaded = true;
        })
        .catch(() => {
          fontsLoaded = true;
        });
    } else {
      fontsLoaded = true;
    }

    const startTime = Date.now();
    const minDuration = 3200; // Đảm bảo người dùng xem trọn vẹn hoạt ảnh nảy sau 1s và các nhịp nhún nhảy vui tươi

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const isSystemReady = windowLoaded && fontsLoaded && !isAuthLoading;

      setProgress((prev) => {
        if (isSystemReady && elapsed >= minDuration) {
          if (prev >= 100) {
            clearInterval(timer);
            return 100;
          }
          return Math.min(100, prev + Math.max(5, Math.floor((100 - prev) * 0.4)));
        }

        // Mô phỏng đường cong tiến trình mượt mà nhịp nhàng theo thời lượng mới
        if (prev < 40) {
          return prev + 1.4;
        } else if (prev < 75) {
          return prev + 0.85;
        } else if (prev < 90) {
          return prev + 0.45;
        }
        return prev;
      });
    }, 45);

    return () => {
      clearInterval(timer);
      window.removeEventListener('load', checkWindowLoad);
    };
  }, [isAuthLoading]);

  // 5. Kết thúc preloader khi hoạt ảnh "ドン!" và chúc mừng hoàn tất trọn vẹn
  const handleProgressDone = React.useCallback(() => {
    setIsFading(true);
    const unmountTimer = setTimeout(() => {
      setIsMounted(false);
      finishPreloader();
    }, 500);
    return () => clearTimeout(unmountTimer);
  }, [finishPreloader]);

  // Fallback an toàn: nếu sau khi đạt 100% mà 3.5s chưa hoàn tất thì tự động đóng
  useEffect(() => {
    if (progress < 100) return;
    const safetyTimer = setTimeout(() => {
      handleProgressDone();
    }, 3500);
    return () => clearTimeout(safetyTimer);
  }, [progress, handleProgressDone]);

  if (!isMounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col items-center justify-center select-none transition-all duration-500 ease-out overflow-hidden ${
        isFading ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      aria-hidden={isFading}
    >
      {/* Background kẻ caro đặc trưng của dự án */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,theme(colors.primary)_1px,transparent_0)] bg-[size:28px_28px] opacity-[0.06] dark:opacity-[0.04]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,theme(colors.foreground)_1px,transparent_1px),linear-gradient(theme(colors.foreground)_1px,transparent_1px)] bg-[size:180px_180px] opacity-[0.03] dark:opacity-[0.04]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/5 dark:to-white/5" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center max-w-md sm:max-w-lg w-full px-4 sm:px-6 -translate-y-20 sm:-translate-y-16">
        {/* Bong bóng chat hình ảnh xuất hiện sau 1s nở êm ái, bập bềnh nhẹ nhàng, tuyệt đối không bị giật, biến mất hay méo hình */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 -mb-8 sm:-mb-10 flex items-center justify-center">
          <AnimatePresence>
            {showBubble && (
              <motion.div
                key="bubble-chat-box"
                initial={{ scale: 0.35, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                  mass: 0.7,
                }}
                className="relative w-full h-full flex items-center justify-center origin-bottom"
              >
                {/* Lớp trôi bồng bềnh êm dịu liên tục, giữ nguyên 100% tỉ lệ hình & chữ */}
                <div className="relative w-full h-full flex items-center justify-center animate-bubble-bob">
                  <Image
                    src={BUBBLE_IMAGE}
                    alt="Bong bóng chat"
                    width={1280}
                    height={1280}
                    priority
                    className="w-full h-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                    unoptimized
                  />
                  {/* Đoạn text nằm chuẩn xác 100% chính giữa khung nét đứt của bong bóng chat, nét chữ sắc nét chuẩn vector */}
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-center pointer-events-none"
                    style={{
                      left: '48.3%',
                      top: '55.0%',
                    }}
                  >
                    <p
                      className="text-[18px] sm:text-[20px] font-normal text-neutral-800 tracking-[0.02em] select-none whitespace-nowrap antialiased"
                      style={{
                        fontFamily: "'UTM Cookies', cursive, sans-serif",
                        fontWeight: 400,
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                        textRendering: 'optimizeLegibility',
                      }}
                    >
                      Bạn chờ một chút nhé!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Khung Sticker động luân phiên như ảnh GIF */}
        <div className="relative w-44 h-32 sm:w-48 sm:h-36 mb-24 sm:mb-28 flex items-center justify-center transform-gpu">
          {STICKER_FRAMES.map((src, idx) => (
            <div
              key={src}
              className={`absolute inset-0 transition-all duration-300 ease-in-out flex items-center justify-center ${
                frameIndex === idx
                  ? 'opacity-100 scale-100 rotate-0'
                  : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              <Image
                src={src}
                alt="Welcome Sticker"
                width={384}
                height={256}
                priority
                className="w-full h-full object-contain filter drop-shadow-[0_8px_20px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_8px_20px_rgba(255,255,255,0.08)]"
                unoptimized
              />
            </div>
          ))}
        </div>

        {/* Thanh tiến trình Sakuga Anime VFX đồng nhất với giao diện */}
        <SakugaProgressBar
          progress={progress}
          isDark={isDark}
          onDone={handleProgressDone}
        />
      </div>
    </div>
  );
}
