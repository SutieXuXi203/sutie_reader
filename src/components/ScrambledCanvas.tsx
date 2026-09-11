'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { generateTilePermutation } from '@/lib/scramble';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';

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

export function ScrambledCanvas({
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
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawImgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [isRetrying, setIsRetrying] = useState(false);

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

    // Generate tile mapping based on secret seed
    const permutation = generateTilePermutation(totalTiles, seedKey);

    // 1. Reconstruct each tile into its original position
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

    // 2. Burn subtle traceable watermark onto canvas pixels
    try {
      ctx.save();
      const watermarkText = user?.email
        ? `${user.email} • Sutie Reader`
        : 'Sutie Reader • Protected Comic';

      ctx.fillStyle = 'rgba(128, 128, 128, 0.08)';
      ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.rotate((-25 * Math.PI) / 180);
      const diag = Math.sqrt(renderW * renderW + renderH * renderH);
      const stepX = 280;
      const stepY = 180;

      for (let x = -diag; x < diag * 1.5; x += stepX) {
        for (let y = -diag; y < diag * 1.5; y += stepY) {
          ctx.fillText(watermarkText, x, y);
        }
      }
      ctx.restore();
    } catch {
      // Watermark fail-safe
    }

    // 3. Tamper-proof canvas export APIs against automated scrapers
    try {
      Object.defineProperty(canvas, 'toDataURL', {
        value: () => {
          console.warn('[Security] Canvas export is disabled.');
          return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(canvas, 'toBlob', {
        value: (cb: BlobCallback) => {
          console.warn('[Security] Canvas export is disabled.');
          cb?.(new Blob([], { type: 'image/png' }));
        },
        configurable: true,
        writable: true,
      });
    } catch {
      // Protection fail-safe
    }

    setStatus('loaded');
    onLoad?.();
  }, [rows, cols, seedKey, onLoad, user]);

  useEffect(() => {
    setStatus('loading');
    const img = new window.Image();
    if (!src.startsWith('/') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    rawImgRef.current = img;

    img.onload = () => {
      drawReconstructedImage();
    };

    img.onerror = () => {
      setStatus('error');
      onError?.();
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, drawReconstructedImage, onError]);

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
      className="relative w-full overflow-hidden bg-muted/10 min-h-[350px] sm:min-h-[500px] flex items-center justify-center group"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 backdrop-blur-xs text-muted-foreground animate-pulse z-10">
          <ShieldCheck className="w-8 h-8 text-primary opacity-60 animate-bounce" />
          <span className="text-xs font-medium opacity-70">
            Đang tải &amp; giải mã ảnh chống cào (Trang {idx + 1})...
          </span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 border border-destructive/20 p-6 text-center z-20">
          <p className="text-sm font-semibold text-foreground">Không thể giải mã trang {idx + 1}</p>
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
}
