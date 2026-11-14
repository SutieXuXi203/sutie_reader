// Motion Prompt #070 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#070
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSpinnerFrame } from '@/lib/spinnerMotion';
import { cn } from '@/lib/utils';

interface MotionSpinnerOverlayProps {
  /** Khi true, kích hoạt hoạt ảnh spinner Motion Prompt #070 */
  active: boolean;
  /** Callback được gọi khi hoàn tất hoạt ảnh (sau khi checkmark hiện và mờ dần) */
  onComplete?: () => void;
  className?: string;
}

export function MotionSpinnerOverlay({
  active,
  onComplete,
  className,
}: MotionSpinnerOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spinnerWrapRef = useRef<HTMLDivElement | null>(null);
  const checkWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const finish = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      setIsVisible(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // Kiểm tra prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    setIsVisible(true);
    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;
      const elapsed = (now - startTimeRef.current) / 1000;
      const frame = getSpinnerFrame(elapsed);

      // Cập nhật opacity của toàn bộ lớp scrim
      if (containerRef.current) {
        containerRef.current.style.opacity = frame.overlayOpacity.toString();
      }

      // Cập nhật spinner
      if (spinnerWrapRef.current) {
        spinnerWrapRef.current.style.opacity = frame.loadOpacity.toString();
        spinnerWrapRef.current.style.display = frame.loadOpacity > 0 ? 'flex' : 'none';
      }

      // Cập nhật checkmark
      if (checkWrapRef.current) {
        checkWrapRef.current.style.opacity = frame.doneOpacity.toString();
        checkWrapRef.current.style.transform = `scale(${frame.doneScale})`;
        checkWrapRef.current.style.display = frame.doneOpacity > 0 ? 'flex' : 'none';
      }

      if (frame.isComplete) {
        finish();
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, finish]);

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center select-none rounded-[8px] transition-none pointer-events-auto',
        'bg-background/80 dark:bg-card/85 backdrop-blur-[2px]',
        className
      )}
      style={{ opacity: 0 }}
    >
      {/* 1. Spinner (Spec Motion Prompt #070: Pale ring r=26, thickness 6, primary arc 243deg turning 1.3 rps) */}
      <div
        ref={spinnerWrapRef}
        className="relative flex items-center justify-center will-change-[transform,opacity]"
        style={{ width: 64, height: 64 }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          className="overflow-visible animate-[mp070-spin_0.769s_linear_infinite]"
        >
          {/* Pale ring (r=26, stroke=6) */}
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            strokeWidth="6"
            className="stroke-muted/30 dark:stroke-white/10"
          />
          {/* Theme Primary arc 243° (1.35π, stroke=6, round caps) */}
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="110.27 163.36"
            transform="rotate(-90 32 32)"
            className="stroke-primary"
          />
        </svg>
      </div>

      {/* 2. Success Checkmark (Spec Motion Prompt #070: Primary circle r=28, white check, scales 0.7 -> 1 easeOutCubic) */}
      <div
        ref={checkWrapRef}
        className="absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground will-change-transform shadow-lg shadow-primary/25"
        style={{ width: 56, height: 56, display: 'none' }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  );
}

export default MotionSpinnerOverlay;

