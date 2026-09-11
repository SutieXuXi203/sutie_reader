'use client';

import * as React from 'react';
import {
  motion,
  useScroll,
  useSpring,
  type MotionValue,
  type HTMLMotionProps,
  type SpringOptions,
} from 'motion/react';

import { Slot, type WithAsChild } from '@/components/animate-ui/primitives/animate/slot';
import { getStrictContext } from '@/lib/get-strict-context';
import { useMotionValueState } from '@/hooks/use-motion-value-state';

type ScrollProgressDirection = 'horizontal' | 'vertical';

type ScrollProgressContextType = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  progress: MotionValue<number>;
  scale: MotionValue<number>;
  direction: ScrollProgressDirection;
  global: boolean;
};

const [LocalScrollProgressProvider, useScrollProgress] =
  getStrictContext<ScrollProgressContextType>('ScrollProgressContext');

type ScrollProgressProviderProps = {
  children: React.ReactNode;
  global?: boolean;
  transition?: SpringOptions;
  direction?: ScrollProgressDirection;
};

function ScrollProgressProvider({
  global = false,
  transition = { stiffness: 250, damping: 40, bounce: 0 },
  direction = 'vertical',
  ...props
}: ScrollProgressProviderProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const { scrollYProgress, scrollXProgress } = useScroll(
    global ? undefined : { container: containerRef },
  );

  const progress = direction === 'vertical' ? scrollYProgress : scrollXProgress;
  const scale = useSpring(progress, transition);

  React.useEffect(() => {
    // Only check on resize to calibrate container boundaries without thrashing layout during active scroll
    const updateProgressOnResize = () => {
      if (global) {
        const scrollTop = typeof window !== 'undefined' ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
        const maxScroll = typeof document !== 'undefined' 
          ? ((document.documentElement.scrollHeight || document.body.scrollHeight || 0) - window.innerHeight)
          : 0;

        if (scrollTop <= 0) {
          progress.set(0);
        } else if (maxScroll > 0) {
          progress.set(Math.min(Math.max(scrollTop / maxScroll, 0), 1));
        }
      }
    };

    const timer = setTimeout(updateProgressOnResize, 150);
    window.addEventListener('resize', updateProgressOnResize, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateProgressOnResize);
    };
  }, [global, progress]);

  return (
    <LocalScrollProgressProvider
      value={{
        containerRef,
        progress,
        scale,
        direction,
        global,
      }}
      {...props}
    />
  );
}

type ScrollProgressMode = 'width' | 'height' | 'scaleY' | 'scaleX';

type ScrollProgressProps = WithAsChild<
  HTMLMotionProps<'div'> & {
    mode?: ScrollProgressMode;
  }
>;

function ScrollProgress({
  style,
  mode = 'width',
  asChild = false,
  ...props
}: ScrollProgressProps) {
  const { scale, direction, global } = useScrollProgress();
  const isTransformScale = mode === 'scaleX' || mode === 'scaleY';
  
  // Only subscribe to React state updates if using width/height mode
  const widthOrHeightValue = useMotionValueState(scale);
  const { children, ...motionProps } = props;

  const progressProps = {
    'data-slot': 'scroll-progress',
    'data-direction': direction,
    'data-mode': mode,
    'data-global': global,
    style: {
      ...(isTransformScale
        ? {
            [mode]: scale,
          }
        : {
            [mode]: widthOrHeightValue * 100 + '%',
          }),
      ...style,
    },
    ...motionProps,
  };

  if (asChild) {
    return <Slot {...progressProps}>{children as React.ReactElement}</Slot>;
  }

  return (
    <motion.div {...progressProps}>{children}</motion.div>
  );
}

type ScrollProgressContainerProps = WithAsChild<HTMLMotionProps<'div'>>;

function ScrollProgressContainer({
  ref,
  asChild = false,
  ...props
}: ScrollProgressContainerProps) {
  const { containerRef, direction, global } = useScrollProgress();
  const { children, ...motionProps } = props;

  React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

  const containerProps = {
    ref: containerRef,
    'data-slot': 'scroll-progress-container',
    'data-direction': direction,
    'data-global': global,
    ...motionProps,
  };

  if (asChild) {
    return <Slot {...containerProps}>{children as React.ReactElement}</Slot>;
  }

  return (
    <motion.div {...containerProps}>{children}</motion.div>
  );
}

export {
  ScrollProgressProvider,
  ScrollProgress,
  ScrollProgressContainer,
  useScrollProgress,
  type ScrollProgressProviderProps,
  type ScrollProgressProps,
  type ScrollProgressContainerProps,
  type ScrollProgressDirection,
  type ScrollProgressMode,
  type ScrollProgressContextType,
};
