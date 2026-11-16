'use client';

// Motion Prompt #006 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#006
// Typewriter / タイプライター
// Áp dụng trực tiếp vào Placeholder của ô Input / Textarea
// Giữ nguyên tiền tố cố định (prefix) và chỉ gõ/xóa lùi phần từ khóa thay đổi luân phiên (suffixes).

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface TypewriterPlaceholderProps {
  /** Phần tiền tố cố định không bị xóa lùi (ví dụ: "Tìm kiếm theo ") */
  prefix?: string;
  /** Danh sách các từ khóa gợi ý luân phiên chỉ bị gõ/xóa lùi phần này */
  placeholders: string[];
  /** Hiển thị hay không (ẩn khi ô input đã có nội dung hoặc đang focus) */
  visible: boolean;
  /** Thời gian giữa mỗi ký tự khi gõ (ms) - mặc định 65ms */
  typingSpeed?: number;
  /** Thời gian giữa mỗi ký tự khi xóa lùi (ms) - mặc định 35ms */
  deleteSpeed?: number;
  /** Thời gian dừng hiển thị nguyên câu trước khi xóa (ms) - mặc định 3000ms để hiển thị đủ 5s mỗi dòng */
  holdDuration?: number;
  /** Thời gian nghỉ sau khi xóa hết trước khi gõ câu kế tiếp (ms) - mặc định 900ms */
  pauseDuration?: number;
  /** Tuỳ biến class cho con trỏ nhấp nháy */
  cursorClassName?: string;
  /** Tuỳ biến class cho container */
  className?: string;
}

type TypewriterPhase = 'typing' | 'holding' | 'deleting' | 'pausing';

export const TypewriterPlaceholder: React.FC<TypewriterPlaceholderProps> = ({
  prefix = '',
  placeholders,
  visible,
  typingSpeed = 65,
  deleteSpeed = 35,
  holdDuration = 3000,
  pauseDuration = 900,
  cursorClassName = 'bg-muted-foreground/70',
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [phase, setPhase] = useState<TypewriterPhase>('typing');

  const currentPlaceholder = placeholders[currentIndex] || '';

  useEffect(() => {
    if (!visible || placeholders.length === 0) return;

    // Hỗ trợ prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(currentPlaceholder);
      setPhase('holding');
      return;
    }

    let timeoutId: NodeJS.Timeout;

    switch (phase) {
      case 'typing': {
        if (displayText.length < currentPlaceholder.length) {
          timeoutId = setTimeout(() => {
            setDisplayText(currentPlaceholder.slice(0, displayText.length + 1));
          }, typingSpeed);
        } else {
          setPhase('holding');
        }
        break;
      }

      case 'holding': {
        timeoutId = setTimeout(() => {
          setPhase('deleting');
        }, holdDuration);
        break;
      }

      case 'deleting': {
        if (displayText.length > 0) {
          timeoutId = setTimeout(() => {
            setDisplayText(displayText.slice(0, -1));
          }, deleteSpeed);
        } else {
          setPhase('pausing');
        }
        break;
      }

      case 'pausing': {
        timeoutId = setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % placeholders.length);
          setPhase('typing');
        }, pauseDuration);
        break;
      }
    }

    return () => clearTimeout(timeoutId);
  }, [
    visible,
    displayText,
    phase,
    currentPlaceholder,
    currentIndex,
    placeholders.length,
    typingSpeed,
    deleteSpeed,
    holdDuration,
    pauseDuration,
  ]);

  if (!visible) return null;

  const isSolidCursor = phase === 'typing' || phase === 'deleting';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-y-0 flex items-center select-none overflow-hidden',
        className
      )}
    >
      <span className="truncate text-muted-foreground/70 font-normal">
        {prefix && <span className="opacity-90">{prefix}</span>}
        {displayText}
      </span>
      {/* Con trỏ cursor: Solid khi gõ hoặc xóa, nhấp nháy bằng CSS GPU thuần khi dừng */}
      <span
        className={cn(
          'inline-block w-[1.5px] h-3.5 ml-0.5 rounded-[1px] transition-opacity',
          isSolidCursor ? 'opacity-100' : 'animate-pulse opacity-80',
          cursorClassName
        )}
      />
    </div>
  );
};

export default TypewriterPlaceholder;
