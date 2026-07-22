'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  User,
  LogIn,
  LogOut,
  LayoutDashboard,
  Home,
  Mail,
  Newspaper,
  ShieldAlert,
  Lock,
  Search,
  Sparkles,
  Clock,
  Sun,
  Moon,
  Trash2,
  Edit3,
  Plus,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconAnimationType = 'scale' | 'bounce' | 'rotate' | 'pulse' | 'shake' | 'spin' | 'none';

export interface AnimateIconProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  icon: LucideIcon;
  size?: number | string;
  color?: string;
  animation?: IconAnimationType;
  iconProps?: LucideProps;
  className?: string;
}

const animationVariants = {
  scale: {
    initial: { scale: 1, rotate: 0 },
    hover: { scale: 1.2, transition: { type: 'spring', stiffness: 400, damping: 17 } },
    tap: { scale: 0.88, transition: { type: 'spring', stiffness: 400, damping: 17 } },
  },
  bounce: {
    initial: { y: 0 },
    hover: { y: -4, scale: 1.08, transition: { type: 'spring', stiffness: 500, damping: 12 } },
    tap: { y: 2, scale: 0.92, transition: { type: 'spring', stiffness: 500, damping: 12 } },
  },
  rotate: {
    initial: { rotate: 0, scale: 1 },
    hover: { rotate: 18, scale: 1.15, transition: { type: 'spring', stiffness: 350, damping: 15 } },
    tap: { rotate: -12, scale: 0.92 },
  },
  pulse: {
    initial: { scale: 1 },
    hover: { scale: [1, 1.22, 1.08, 1.18], transition: { duration: 0.6, repeat: Infinity, repeatType: 'reverse' as const } },
    tap: { scale: 0.88 },
  },
  shake: {
    initial: { rotate: 0 },
    hover: { rotate: [0, -14, 14, -8, 8, 0], transition: { duration: 0.4 } },
    tap: { scale: 0.9 },
  },
  spin: {
    initial: { rotate: 0 },
    hover: { rotate: 360, transition: { duration: 0.6, ease: 'easeInOut' } },
    tap: { scale: 0.9 },
  },
  none: {
    initial: {},
    hover: {},
    tap: {},
  },
};

export function AnimateIcon({
  icon: IconComponent,
  size,
  color,
  animation = 'scale',
  iconProps,
  className,
  ...props
}: AnimateIconProps) {
  const variant = animationVariants[animation] || animationVariants.scale;

  return (
    <motion.div
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      variants={variant}
      className={cn('inline-flex items-center justify-center shrink-0 select-none', className)}
      {...props}
    >
      <IconComponent size={size} color={color} {...iconProps} className="w-full h-full" />
    </motion.div>
  );
}

// Preset Animated Icon Wrappers for common Lucide icons
export const AnimatedBookOpen = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={BookOpen} animation="bounce" {...props} />;
export const AnimatedArrowLeft = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={ArrowLeft} animation="bounce" {...props} />;
export const AnimatedArrowRight = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={ArrowRight} animation="bounce" {...props} />;
export const AnimatedBookmark = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Bookmark} animation="scale" {...props} />;
export const AnimatedBookmarkCheck = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={BookmarkCheck} animation="pulse" {...props} />;
export const AnimatedUser = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={User} animation="scale" {...props} />;
export const AnimatedLogIn = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={LogIn} animation="bounce" {...props} />;
export const AnimatedLogOut = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={LogOut} animation="rotate" {...props} />;
export const AnimatedDashboard = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={LayoutDashboard} animation="rotate" {...props} />;
export const AnimatedHome = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Home} animation="bounce" {...props} />;
export const AnimatedMail = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Mail} animation="shake" {...props} />;
export const AnimatedNewspaper = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Newspaper} animation="rotate" {...props} />;
export const AnimatedShieldAlert = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={ShieldAlert} animation="pulse" {...props} />;
export const AnimatedLock = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Lock} animation="shake" {...props} />;
export const AnimatedSearch = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Search} animation="scale" {...props} />;
export const AnimatedSparkles = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Sparkles} animation="rotate" {...props} />;
export const AnimatedClock = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Clock} animation="spin" {...props} />;
export const AnimatedSun = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Sun} animation="rotate" {...props} />;
export const AnimatedMoon = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Moon} animation="rotate" {...props} />;
export const AnimatedTrash = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Trash2} animation="shake" {...props} />;
export const AnimatedEdit = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Edit3} animation="rotate" {...props} />;
export const AnimatedPlus = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Plus} animation="rotate" {...props} />;
export const AnimatedTag = (props: Omit<AnimateIconProps, 'icon'>) => <AnimateIcon icon={Tag} animation="scale" {...props} />;
