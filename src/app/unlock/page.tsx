'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Unlock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { gooeyToast } from 'goey-toast';

export default function UnlockPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <UnlockForm />
    </React.Suspense>
  );
}

function UnlockForm() {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setIsError(false);

    // Auto-focus next
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all filled
    if (value && index === 5 && newPin.every(d => d !== '')) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0 && inputRefs.current[index - 1]) {
        // If empty and backspace pressed, go to previous and clear it
        const newPin = [...pin];
        newPin[index - 1] = '';
        setPin(newPin);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Just clear current
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
      }
      setIsError(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;
    
    const newPin = [...pin];
    for (let i = 0; i < pastedData.length; i++) {
      newPin[i] = pastedData[i];
    }
    setPin(newPin);
    setIsError(false);

    if (pastedData.length === 6) {
      inputRefs.current[5]?.focus();
      handleSubmit(newPin.join(''));
    } else {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  const handleSubmit = async (fullPin: string) => {
    if (fullPin.length !== 6) return;
    
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
        gooeyToast.success('Mở khóa thành công', {
          description: 'Chào mừng bạn quay lại Sutie Reader!',
        });
        // Short delay for the animation to play
        setTimeout(() => {
          router.push(callbackUrl);
          router.refresh();
        }, 500);
      } else {
        setIsError(true);
        gooeyToast.error('Lỗi xác thực', {
          description: data.error || 'Mã PIN không chính xác',
        });
        setPin(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      setIsError(true);
      gooeyToast.error('Đã xảy ra lỗi', {
        description: 'Vui lòng thử lại sau',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden p-4">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[90px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-8 md:p-10 shadow-2xl text-center">
          
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
            className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl mx-auto flex items-center justify-center mb-6 text-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]"
          >
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isError ? (
              <Lock className="w-8 h-8 text-destructive" />
            ) : (
              <ShieldCheck className="w-8 h-8" />
            )}
          </motion.div>

          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-3">
            Khu vực giới hạn
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            Vui lòng nhập mã PIN bảo mật 6 số để truy cập vào hệ thống nội bộ của Sutie Reader.
          </p>

          <motion.div 
            animate={isError ? { x: [-10, 10, -10, 10, -5, 5, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex justify-between gap-2 md:gap-3 mb-8"
          >
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                disabled={isLoading}
                className={`w-12 h-14 md:w-14 md:h-16 text-center text-xl md:text-2xl font-bold bg-background/50 border-2 rounded-xl outline-none transition-all duration-200 
                  ${digit ? 'border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] text-primary' : 'border-border text-foreground focus:border-primary/50 focus:bg-background'}
                  ${isError ? 'border-destructive text-destructive bg-destructive/5' : ''}
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              />
            ))}
          </motion.div>

          <div className="flex flex-col gap-4 mt-6">
            <button
              onClick={() => handleSubmit(pin.join(''))}
              disabled={isLoading || pin.join('').length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-3.5 rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
            >
              {isLoading ? (
                <span>Đang kiểm tra...</span>
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
