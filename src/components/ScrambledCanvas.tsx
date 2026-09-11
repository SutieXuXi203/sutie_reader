'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { generateTilePermutation } from '@/lib/scramble';
import { ImageIcon, RefreshCw } from 'lucide-react';

interface ScrambledCanvasProps {
  src: string;
  seedKey: string;
  rows?: number;
  cols?: number;
  alt?: string;
  idx?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const ScrambledCanvas = React.memo(function ScrambledCanvas({
  src,
  seedKey,
  rows = 8,
  cols = 8,
  alt = 'Trang truyện',
  idx = 0,
  className = 'w-full h-auto block select-none',
  onLoad,
  onError,
}: ScrambledCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawImgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [isRetrying, setIsRetrying] = useState(false);

  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const drawReconstructedImage = useCallback(() => {
    const img = rawImgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return;

    const totalTiles = rows * cols;
    const tileW = Math.floor(naturalW / cols);
    const tileH = Math.floor(naturalH / rows);
    const renderW = tileW * cols;
    const renderH = tileH * rows;

    canvas.width = renderW;
    canvas.height = renderH;

    // Disable smoothing so GPU doesn't bleed adjacent scrambled tiles into edges
    ctx.imageSmoothingEnabled = false;

    // Generate tile mapping based on secret seed
    const permutation = generateTilePermutation(totalTiles, seedKey);

    // 1. Reconstruct each tile into its exact original position (bit-for-bit 1:1 transfer)
    for (let scramIndex = 0; scramIndex < totalTiles; scramIndex++) {
      const origIndex = permutation[scramIndex];

      // Coordinate on scrambled raw image
      const sx = (scramIndex % cols) * tileW;
      const sy = Math.floor(scramIndex / cols) * tileH;

      // Destination coordinate on reconstructed canvas
      const dx = (origIndex % cols) * tileW;
      const dy = Math.floor(origIndex / cols) * tileH;

      ctx.drawImage(img, sx, sy, tileW, tileH, dx, dy, tileW, tileH);
    }

    // 2. Tamper-proof canvas export APIs: return scrambled image to scraper tools
    try {
      Object.defineProperty(canvas, 'toDataURL', {
        value: () => {
          console.warn('[Security] Canvas export is protected.');
          return rawImgRef.current?.src || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(canvas, 'toBlob', {
        value: (cb: BlobCallback) => {
          console.warn('[Security] Canvas export is protected.');
          cb?.(new Blob([], { type: 'image/png' }));
        },
        configurable: true,
        writable: true,
      });
    } catch {
      // Protection fail-safe
    }

    setStatus('loaded');
    onLoadRef.current?.();
  }, [rows, cols, seedKey]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const img = new window.Image();
    if (!src.startsWith('/') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    rawImgRef.current = img;

    img.onload = () => {
      if (cancelled) return;
      drawReconstructedImage();
    };

    img.onerror = () => {
      if (cancelled) return;
      setStatus('error');
      onErrorRef.current?.();
    };

    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, drawReconstructedImage]);

  const handleRetry = () => {
    setIsRetrying(true);
    setStatus('loading');
    const freshSrc = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const img = new window.Image();
    if (!freshSrc.startsWith('/') && !freshSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    rawImgRef.current = img;

    img.onload = () => {
      drawReconstructedImage();
      setIsRetrying(false);
    };
    img.onerror = () => {
      setStatus('error');
      setIsRetrying(false);
    };
    img.src = freshSrc;
  };

  return (
    <div
      className={`relative w-full overflow-hidden flex items-center justify-center group ${
        status === 'loaded' ? '' : 'min-h-[300px] bg-muted/10'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 backdrop-blur-xs text-muted-foreground animate-pulse z-10">
          <ImageIcon className="w-8 h-8 opacity-40 animate-bounce" />
          <span className="text-xs font-medium opacity-60">
            Đang tải trang {idx + 1}...
          </span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 border border-destructive/20 p-6 text-center z-20">
          <p className="text-sm font-semibold text-foreground">Không thể tải trang {idx + 1}</p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Canvas view (Reconstructed clean image) */}
      <canvas
        ref={canvasRef}
        className={`${className} transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ pointerEvents: 'none' }}
      />

      {/* Protective Transparent Overlay to prevent context menu and drag */}
      <div
        className="absolute inset-0 z-10 select-none"
        style={{ WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
});
