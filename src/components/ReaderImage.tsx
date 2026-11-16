'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { RefreshCw, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { extractDriveImageId, ensureScrambledImageUrl } from '@/lib/utils';
import { parseScrambleParams } from '@/lib/scramble';
import { ScrambledCanvas } from './ScrambledCanvas';

interface ReaderImageProps {
  src: string;
  alt: string;
  idx: number;
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
}

export const ReaderImage = React.memo(function ReaderImage({
  src,
  alt,
  idx,
  priority = false,
  className = 'w-full h-auto block select-none',
  width = 1200,
  height = 1800,
  onLoad,
}: ReaderImageProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [currentSrc, setCurrentSrc] = useState<string>(() => ensureScrambledImageUrl(src));
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isInViewportOrNear, setIsInViewportOrNear] = useState(
    () => priority || (typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined')
  );
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize when src prop changes
  if (prevSrc !== src) {
    setPrevSrc(src);
    setCurrentSrc(ensureScrambledImageUrl(src));
    setStatus('loading');
    setRetryCount(0);
    setIsRetrying(false);
    if (priority) {
      setIsInViewportOrNear(true);
    }
  }

  // Virtual Windowing Observer:
  // Tự động giải phóng Canvas khỏi RAM khi cuộn xa quá 2500px, và vẽ lại tức thì khi cuộn lại gần.
  // Giúp trình duyệt (đặc biệt là iOS Safari) không bao giờ bị tràn VRAM khi đọc chương 500 ảnh.
  useEffect(() => {
    if (priority) {
      setIsInViewportOrNear(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsInViewportOrNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const isNear = entry.isIntersecting || entry.intersectionRatio > 0;
        setIsInViewportOrNear(isNear);
      },
      {
        rootMargin: '2500px 0px 2500px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const handleAutoFallback = useCallback(() => {
    const fileId = extractDriveImageId(src);

    if (retryCount === 0 && fileId) {
      // First retry: switch to internal proxy endpoint which generates fresh server signature on the fly
      setRetryCount(1);
      // Giữ nguyên pid (gợi ý bài viết) của URL gốc để server tra quyền bằng _id thay vì phải tìm ảnh theo id
      setCurrentSrc(`${ensureScrambledImageUrl(src)}&retry=1&t=${Date.now()}`);
      setStatus('loading');
    } else if (retryCount < 3 && fileId) {
      // Subsequent auto retries with slight delay for network jitter
      setIsRetrying(true);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setCurrentSrc(`${ensureScrambledImageUrl(src)}&retry=${retryCount + 1}&t=${Date.now()}`);
        setIsRetrying(false);
        setStatus('loading');
      }, 1000);
    } else {
      // Exhausted automatic retries, show manual retry UI
      setStatus('error');
    }
  }, [src, retryCount]);

  const handleManualRetry = () => {
    const fileId = extractDriveImageId(src);
    setStatus('loading');
    setIsRetrying(true);
    setRetryCount(1);

    if (fileId) {
      setCurrentSrc(`${ensureScrambledImageUrl(src)}&manual=1&t=${Date.now()}`);
    } else {
      setCurrentSrc(`${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`);
    }
    setTimeout(() => setIsRetrying(false), 500);
  };

  const handleLoaded = useCallback(() => {
    setStatus('loaded');
    if (containerRef.current) {
      const h = containerRef.current.offsetHeight;
      if (h > 50) {
        setMeasuredHeight(h);
      }
    }
    onLoad?.();
  }, [onLoad]);

  const scrambleMeta = useMemo(() => parseScrambleParams(currentSrc), [currentSrc]);

  return (
    <div
      ref={containerRef}
      style={measuredHeight ? { minHeight: `${measuredHeight}px` } : undefined}
      className={`relative w-full overflow-hidden flex items-center justify-center ${
        status === 'loaded' ? '' : 'min-h-[300px] bg-muted/10'
      }`}
    >
      {/* Loading Skeleton & Indicator */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 backdrop-blur-xs text-muted-foreground animate-pulse z-10">
          <ImageIcon className="w-8 h-8 opacity-40 animate-bounce" />
          <span className="text-xs font-medium opacity-60">Đang tải trang {idx + 1}...</span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 border border-destructive/20 p-6 text-center z-20">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Không thể tải trang {idx + 1}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đường truyền chập chờn hoặc link ảnh đã hết hạn
            </p>
          </div>
          <button
            type="button"
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Đang tải lại...' : 'Tải lại trang này'}</span>
          </button>
        </div>
      )}

      {/* Main Image - Smart Loaded (ScrambledCanvas for anti-scrape, Image for regular) */}
      {isInViewportOrNear && currentSrc && (
        scrambleMeta.isScrambled ? (
          <ScrambledCanvas
            src={currentSrc}
            seedKey={scrambleMeta.seed}
            rows={scrambleMeta.rows}
            cols={scrambleMeta.cols}
            alt={alt}
            idx={idx}
            className={className}
            onLoad={handleLoaded}
            onError={handleAutoFallback}
          />
        ) : (
          <Image
            src={currentSrc}
            alt={alt}
            width={width}
            height={height}
            className={`${className} transition-opacity duration-300 ${
              status === 'loaded' ? 'opacity-100' : 'opacity-0'
            }`}
            unoptimized
            priority={priority}
            onLoad={handleLoaded}
            onError={handleAutoFallback}
          />
        )
      )}
    </div>
  );
});
