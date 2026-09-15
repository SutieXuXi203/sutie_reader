'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  UserCheck,
  User,
  Shield,
  Loader2,
  Lock,
} from 'lucide-react';

export type UserRole = 'guest' | 'user' | 'admin';

export interface RoleConfigItem {
  name: UserRole;
  label: string;
  badgeLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  triggerBadge: string;
  activeMenu: string;
  iconBox: string;
}

export const ROLE_CONFIG: Record<UserRole, RoleConfigItem> = {
  admin: {
    name: 'admin',
    label: 'Quản trị (Admin)',
    badgeLabel: 'Quản trị viên',
    description: 'Toàn quyền quản trị hệ thống & bài viết',
    icon: ShieldCheck,
    triggerBadge:
      'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-300/80 dark:border-purple-500/40 hover:bg-purple-500/15 hover:border-purple-400 dark:hover:border-purple-400 focus-visible:ring-purple-400/30',
    activeMenu: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold',
    iconBox: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-400/30',
  },
  user: {
    name: 'user',
    label: 'Thành viên (User)',
    badgeLabel: 'Thành viên',
    description: 'Đọc toàn bộ truyện & tài nguyên',
    icon: UserCheck,
    triggerBadge:
      'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-300/80 dark:border-sky-500/40 hover:bg-sky-500/15 hover:border-sky-400 dark:hover:border-sky-400 focus-visible:ring-sky-400/30',
    activeMenu: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold',
    iconBox: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-400/30',
  },
  guest: {
    name: 'guest',
    label: 'Khách (Guest)',
    badgeLabel: 'Khách',
    description: 'Chỉ xem các nội dung công khai',
    icon: User,
    triggerBadge:
      'bg-secondary/90 text-foreground/80 border-border/80 hover:bg-secondary hover:text-foreground hover:border-border focus-visible:ring-primary/20',
    activeMenu: 'bg-secondary text-foreground font-semibold',
    iconBox: 'bg-secondary text-muted-foreground border-border/60',
  },
};

export const ROLE_OPTIONS: UserRole[] = ['guest', 'user', 'admin'];

export interface UserRoleSelectProps {
  role: string | undefined;
  onChange: (newRole: UserRole) => void;
  disabled?: boolean;
  isLoading?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export const UserRoleSelect = React.memo(function UserRoleSelect({
  role,
  onChange,
  disabled = false,
  isLoading = false,
  size = 'default',
  className,
}: UserRoleSelectProps) {
  const currentRole: UserRole =
    role === 'admin' ? 'admin' : role === 'user' ? 'user' : 'guest';
  const currentConfig = ROLE_CONFIG[currentRole];
  const CurrentIcon = currentConfig.icon;

  return (
    <div
      className={cn('inline-flex', className)}
      title={
        disabled
          ? 'Không thể tự thay đổi vai trò của chính mình'
          : 'Nhấp để thay đổi vai trò người dùng'
      }
    >
      <Select
        value={currentRole}
        disabled={disabled || isLoading}
        onValueChange={(val: string | null) => {
          if (val && val !== currentRole && val in ROLE_CONFIG) {
            onChange(val as UserRole);
          }
        }}
      >
        <SelectTrigger
          size={size}
          disabled={disabled || isLoading}
          className={cn(
            '!h-7.5 px-2.5 py-0 rounded-[8px] font-semibold transition-all border inline-flex items-center justify-between cursor-pointer gap-2 shadow-xs select-none',
            size === 'sm' && '!h-7 px-2 text-[11px]',
            currentConfig.triggerBadge,
            disabled && 'opacity-65 cursor-not-allowed hover:bg-transparent',
            isLoading && 'cursor-wait opacity-80'
          )}
        >
          <SelectValue>
            {() => (
              <span className="flex items-center gap-1.5 min-w-0">
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                ) : (
                  <CurrentIcon className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">{currentConfig.label}</span>
                {disabled && !isLoading && (
                  <Lock className="w-2.5 h-2.5 text-muted-foreground shrink-0 ml-0.5" />
                )}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent
          align="center"
          side="bottom"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="rounded-[12px] border border-border/80 bg-popover/95 backdrop-blur-xl p-1.5 shadow-2xl z-50 w-[310px] sm:w-[330px] max-w-[calc(100vw-2rem)]"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-b border-border/50 mb-1 flex items-center justify-between select-none">
            <span>Phân quyền vai trò</span>
            <Shield className="w-3 h-3 text-muted-foreground/50" />
          </div>

          {ROLE_OPTIONS.map((opt) => {
            const item = ROLE_CONFIG[opt];
            const ItemIcon = item.icon;
            const isSelected = opt === currentRole;

            return (
              <SelectItem
                key={opt}
                value={opt}
                indicatorPosition="right"
                className={cn(
                  'relative flex items-center gap-2.5 rounded-[8px] py-2.5 pl-2.5 pr-10 text-xs cursor-pointer transition-colors my-0.5 outline-hidden',
                  isSelected
                    ? cn(item.activeMenu, 'bg-accent/70')
                    : 'text-foreground hover:bg-accent/60 hover:text-accent-foreground'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'w-7.5 h-7.5 rounded-[7px] flex items-center justify-center shrink-0 border',
                      item.iconBox
                    )}
                  >
                    <ItemIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left min-w-0 flex-1 pr-1">
                    <p className="font-semibold text-xs text-foreground leading-tight">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-normal leading-tight mt-0.5 whitespace-normal">
                      {item.description}
                    </p>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
});
