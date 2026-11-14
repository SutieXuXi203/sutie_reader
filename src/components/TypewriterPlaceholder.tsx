'use client';

// Motion Prompt #006 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#006
// Typewriter / タイプライター
// Áp dụng trực tiếp vào Placeholder của ô Input / Textarea
// Gõ từng ký tự với nhịp gõ đều, con trỏ nhấp nháy 0.94s và hiệu ứng trượt mờ khi chuyển câu gợi ý.

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TypewriterPlaceholderProps {
  /** Danh sách các câu gợi ý luân phiên */
  placeholders: string[];
  /** Hiển thị hay không (ẩn khi ô input đã có nội dung hoặc đang focus) */
  visible: boolean;
  /** Thời gian giữa mỗi ký tự khi gõ (ms) - mặc định 110ms */
  typingSpeed?: number;
  /** Thời gian dừng hiển thị nguyên câu trước khi chuyển câu mới (ms) - mặc định 2400ms */
  holdDuration?: number;
  /** Tuỳ biến class cho con trỏ nhấp nháy */
  cursorClassName?: string;
  /** Tuỳ biến class cho container */
  className?: string;
}

export const TypewriterPlaceholder: React.FC<TypewriterPlaceholderProps> = ({
  placeholders,
  visible,
  typingSpeed = 110,
  holdDuration = 2400,
  cursorClassName = 'bg-primary/90',
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  const currentPlaceholder = placeholders[currentIndex] || '';

  // Quản lý việc gõ từng ký tự theo nhịp độ spec #006
  useEffect(() => {
    if (!visible || placeholders.length === 0) return;

    let timeoutId: NodeJS.Timeout;

    if (isTransitioning) {
      // Khi câu cũ trôi lên và mờ dần, chuẩn bị chuyển sang câu tiếp theo
      timeoutId = setTimeout(() => {
        setIsTransitioning(false);
        setDisplayText('');
        setCurrentIndex((prev) => (prev + 1) % placeholders.length);
        setIsTyping(true);
      }, 300);
      return () => clearTimeout(timeoutId);
    }

    if (isTyping) {
      if (displayText.length < currentPlaceholder.length) {
        // Gõ ký tự tiếp theo
        timeoutId = setTimeout(() => {
          setDisplayText(currentPlaceholder.slice(0, displayText.length + 1));
        }, typingSpeed);
      } else {
        // Đã gõ xong toàn bộ câu -> chuyển sang trạng thái dừng (hold)
        setIsTyping(false);
        timeoutId = setTimeout(() => {
          // Bắt đầu hiệu ứng trôi lên và mờ dần (tương đương clr trong spec #006)
          setIsTransitioning(true);
        }, holdDuration);
      }
    }

    return () => clearTimeout(timeoutId);
  }, [
    visible,
    displayText,
    isTyping,
    isTransitioning,
    currentPlaceholder,
    currentIndex,
    placeholders.length,
    typingSpeed,
    holdDuration,
  ]);

  // Quản lý con trỏ nhấp nháy (chu kỳ 0.94s từ spec #006: sáng 0.5s, tắt 0.44s)
  useEffect(() => {
    if (!visible) return;

    if (isTyping) {
      setIsBlinking(true); // Luôn sáng khi đang gõ
      return;
    }

    // Khi đang chờ: nhấp nháy chu kỳ ~0.94s
    const intervalId = setInterval(() => {
      setIsBlinking((prev) => !prev);
    }, 470);

    return () => clearInterval(intervalId);
  }, [visible, isTyping]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-y-0 flex items-center select-none overflow-hidden transition-all duration-300',
        isTransitioning ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0',
        className
      )}
    >
      <span className="truncate text-muted-foreground/70 font-normal">
        {displayText}
      </span>
      {/* Con trỏ cursor chuẩn Motion Prompt #006 */}
      <span
        className={cn(
          'inline-block w-[1.5px] h-3.5 ml-0.5 rounded-[1px] transition-opacity duration-150',
          cursorClassName,
          isBlinking ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
};

export default TypewriterPlaceholder;

