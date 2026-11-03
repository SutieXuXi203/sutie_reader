'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [cursorText, setCursorText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isPointer, setIsPointer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Disable on touch screens or small devices
    if (typeof window === 'undefined') return;
    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) return;

    const cursor = cursorRef.current;
    const follower = followerRef.current;
    if (!cursor || !follower) return;

    // Use GSAP quickTo for zero-lag smooth interpolation
    const xDot = gsap.quickTo(cursor, 'x', { duration: 0.08, ease: 'power3.out' });
    const yDot = gsap.quickTo(cursor, 'y', { duration: 0.08, ease: 'power3.out' });
    
    const xFollower = gsap.quickTo(follower, 'x', { duration: 0.35, ease: 'power3.out' });
    const yFollower = gsap.quickTo(follower, 'y', { duration: 0.35, ease: 'power3.out' });

    const onMouseMove = (e: MouseEvent) => {
      if (!isVisible) setIsVisible(true);
      xDot(e.clientX);
      yDot(e.clientY);
      xFollower(e.clientX);
      yFollower(e.clientY);
    };

    const onMouseDown = () => {
      gsap.to(follower, { scale: 0.8, duration: 0.15 });
    };

    const onMouseUp = () => {
      gsap.to(follower, { scale: isHovered ? 1.8 : isPointer ? 1.4 : 1, duration: 0.2 });
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const projectEl = target.closest('[data-cursor-project]');
      if (projectEl) {
        setIsHovered(true);
        setIsPointer(false);
        const label = projectEl.getAttribute('data-cursor-project') || 'VIEW';
        setCursorText(label);
        return;
      }

      const interactive = target.closest('a, button, [role="button"], input, textarea, [data-cursor-pointer]');
      if (interactive) {
        setIsPointer(true);
        setIsHovered(false);
        setCursorText('');
        return;
      }

      setIsHovered(false);
      setIsPointer(false);
      setCursorText('');
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseover', onMouseOver);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseover', onMouseOver);
    };
  }, [isVisible, isHovered, isPointer]);

  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <div className={`pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Precision center dot */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 -ml-1 -mt-1 w-2 h-2 rounded-full bg-foreground shadow-sm pointer-events-none"
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      />

      {/* Trailing follower circle */}
      <div
        ref={followerRef}
        className={`fixed top-0 left-0 -ml-5 -mt-5 rounded-full flex items-center justify-center pointer-events-none transition-[width,height,background-color,border-color] duration-200 ease-out backdrop-blur-[2px] ${
          isHovered
            ? 'w-20 h-20 -ml-10 -mt-10 bg-primary/80 text-primary-foreground border border-primary/50 shadow-xl'
            : isPointer
            ? 'w-12 h-12 -ml-6 -mt-6 bg-foreground/10 border border-foreground/30'
            : 'w-10 h-10 bg-foreground/5 border border-foreground/20'
        }`}
        style={{ transform: 'translate3d(-100px, -100px, 0)' }}
      >
        {isHovered && (
          <span
            ref={textRef}
            className="text-[10px] font-bold tracking-widest uppercase select-none animate-in fade-in zoom-in-75 duration-150"
          >
            {cursorText}
          </span>
        )}
      </div>
    </div>
  );
}

