'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, ArrowRight, ShieldCheck, Loader2, Delete } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { gooeyToast } from 'goey-toast';

export default function UnlockPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <UnlockForm />
    </React.Suspense>
  );
}

function UnlockForm() {
  const [pin, setPin] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  // Auto focus input on mount for rapid typing
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(rawValue);
    setIsError(false);

    if (rawValue.length === 6) {
      handleSubmit(rawValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pin.length === 6) {
      handleSubmit(pin);
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleKeyPress = (digit: string) => {
    if (isLoading || isSuccess) return;
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setIsError(false);
      if (nextPin.length === 6) {
        handleSubmit(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (isLoading || isSuccess || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
  };

  const handleSubmit = async (fullPin: string) => {
    if (fullPin.length !== 6 || isLoading || isSuccess) return;
    
    setIsLoading(true);
    setIsError(false);
    
    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: fullPin }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setIsSuccess(true);
        setIsLoading(false);
        gooeyToast.success('Mở khóa thành công', {
          description: 'Chào mừng bạn quay lại Sutie Reader!',
        });
        setTimeout(() => {
          window.location.replace(callbackUrl);
        }, 150);
      } else {
        setIsError(true);
        setIsLoading(false);
        gooeyToast.error('Lỗi xác thực', {
          description: data.error || 'Mã PIN không chính xác',
        });
        setPin('');
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      setIsError(true);
      setIsLoading(false);
      gooeyToast.error('Đã xảy ra lỗi', {
        description: 'Vui lòng thử lại sau',
      });
      setPin('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-4 select-none touch-manipulation">
      {/* Ambient background glows - hardware accelerated for smooth 60/120fps */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-primary/10 rounded-full blur-[80px] pointer-events-none transform-gpu" />
      <div className="absolute top-0 right-0 w-[250px] sm:w-[300px] h-[250px] sm:h-[300px] bg-blue-500/10 rounded-full blur-[60px] pointer-events-none transform-gpu" />
      <div className="absolute bottom-0 left-0 w-[300px] sm:w-[400px] h-[300px] sm:h-[400px] bg-purple-500/10 rounded-full blur-[70px] pointer-events-none transform-gpu" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md transform-gpu"
      >
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl text-center">
          
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.05 }}
            className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl mx-auto flex items-center justify-center mb-5 text-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]"
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isSuccess ? (
              <ShieldCheck className="w-8 h-8 text-green-500" />
            ) : isError ? (
              <Lock className="w-8 h-8 text-destructive" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </motion.div>

          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
            Khu vực giới hạn
          </h1>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
            Vui lòng nhập mã PIN bảo mật 6 số để truy cập vào hệ thống nội bộ của Sutie Reader.
          </p>

          {/* Unified Fast PIN Input Container */}
          <motion.div 
            animate={isError ? { x: [-10, 10, -10, 10, -4, 4, 0] } : {}}
            transition={{ duration: 0.35 }}
            onClick={handleContainerClick}
            className="relative flex justify-center gap-2 sm:gap-2.5 md:gap-3 mb-6 cursor-text py-1"
          >
            {/* Real invisible input capturing all typing without focus hopping */}
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={pin}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isLoading || isSuccess}
              className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-pointer caret-transparent"
              aria-label="Nhập mã PIN"
            />

            {/* 6 Visual Digit Slots */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const digit = pin[i];
              const isActive = isFocused && (pin.length === i || (pin.length === 6 && i === 5));
              return (
                <div
                  key={i}
                  className={`w-11 h-13 sm:w-12 sm:h-15 md:w-14 md:h-16 flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-bold rounded-2xl border-2 transition-all duration-150 transform-gpu
                    ${digit 
                      ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.2)] scale-[1.03]' 
                      : isActive 
                        ? 'border-primary ring-2 ring-primary/30 bg-background/80 shadow-[0_0_10px_rgba(var(--primary),0.15)]' 
                        : 'border-border/80 bg-background/40 text-foreground/40'}
                    ${isError ? 'border-destructive text-destructive bg-destructive/10' : ''}
                    ${isLoading ? 'opacity-60' : ''}
                  `}
                >
                  {digit ? (
                    <span className="animate-in fade-in zoom-in-75 duration-100">{digit}</span>
                  ) : isActive && !isLoading && !isSuccess ? (
                    <span className="w-0.5 h-6 bg-primary animate-pulse rounded-full" />
                  ) : null}
                </div>
              );
            })}
          </motion.div>

          <div className="flex flex-col gap-3 mt-4">
            <button
              onClick={() => handleSubmit(pin)}
              disabled={isLoading || isSuccess || pin.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-3.5 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <span>Đang kiểm tra...</span>
              ) : isSuccess ? (
                <span>Đang chuyển hướng...</span>
              ) : (
                <>
                  <span>Xác nhận mở khóa</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              Mã PIN bảo mật giúp ngăn chặn truy cập trái phép.
            </p>
          </div>
          
        </div>
      </motion.div>
    </div>
  );
}
