'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { RefreshCw, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { extractDriveImageId, getOptimizedImageUrl } from '@/lib/utils';
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
  const [currentSrc, setCurrentSrc] = useState<string>(() => getOptimizedImageUrl(src));
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isInViewportOrNear, setIsInViewportOrNear] = useState(
    () => priority || (typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined')
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize when src prop changes
  if (prevSrc !== src) {
    setPrevSrc(src);
    setCurrentSrc(getOptimizedImageUrl(src));
    setStatus('loading');
    setRetryCount(0);
    setIsRetrying(false);
    if (priority) {
      setIsInViewportOrNear(true);
    }
  }

  // Smart Preload Observer: Preload when image is within 1200px (approx 2-3 screen heights) of viewport
  useEffect(() => {
    if (priority || isInViewportOrNear) return;

    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setIsInViewportOrNear(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
          setIsInViewportOrNear(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '1200px 0px 1200px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [priority, isInViewportOrNear]);

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
      setCurrentSrc(`/api/image/${encodeURIComponent(fileId)}?v=2&retry=1&t=${Date.now()}`);
      setStatus('loading');
    } else if (retryCount < 3 && fileId) {
      // Subsequent auto retries with slight delay for network jitter
      setIsRetrying(true);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        setCurrentSrc(`/api/image/${encodeURIComponent(fileId)}?v=2&retry=${retryCount + 1}&t=${Date.now()}`);
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
      setCurrentSrc(`/api/image/${encodeURIComponent(fileId)}?v=2&manual=1&t=${Date.now()}`);
    } else {
      setCurrentSrc(`${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`);
    }
    setTimeout(() => setIsRetrying(false), 500);
  };

  const handleLoaded = useCallback(() => {
    setStatus('loaded');
    onLoad?.();
  }, [onLoad]);

  const scrambleMeta = useMemo(() => parseScrambleParams(currentSrc), [currentSrc]);

  return (
    <div
      ref={containerRef}
      style={{ aspectRatio: `${width} / ${height}` }}
      className="relative w-full overflow-hidden bg-muted/10 flex items-center justify-center"
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
