'use client';

import { useId, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPageItems } from '@/lib/pagination';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Hiện ô "Đi tới trang" khi số trang lớn hơn ngưỡng này (mặc định 7). */
  jumpThreshold?: number;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  jumpThreshold = 7,
  className,
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState('');
  const jumpId = useId();

  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const items = getPageItems(current, totalPages);

  const goTo = (target: number) => {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next !== current) onPageChange(next);
  };

  const submitJump = () => {
    const parsed = parseInt(jumpValue, 10);
    if (!Number.isNaN(parsed)) goTo(parsed);
    setJumpValue('');
  };

  return (
    <nav
      aria-label="Phân trang"
      className={cn('flex flex-col items-center gap-3', className)}
    >
      <div className="flex items-center justify-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Trang đầu"
          title="Trang đầu"
          className="hidden sm:inline-flex"
          onClick={() => goTo(1)}
          disabled={current === 1}
        >
          <ChevronsLeft />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Trang trước"
          title="Trang trước"
          onClick={() => goTo(current - 1)}
          disabled={current === 1}
        >
          <ChevronLeft />
        </Button>

        {items.map((item) =>
          typeof item === 'number' ? (
            <Button
              key={item}
              type="button"
              variant={item === current ? 'default' : 'ghost'}
              size="icon-sm"
              aria-label={`Trang ${item}`}
              aria-current={item === current ? 'page' : undefined}
              className={cn('tabular-nums', item === current && 'pointer-events-none')}
              onClick={() => goTo(item)}
            >
              {item}
            </Button>
          ) : (
            <span
              key={item}
              aria-hidden="true"
              className="flex size-8 items-center justify-center text-sm text-muted-foreground select-none"
            >
              …
            </span>
          )
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Trang sau"
          title="Trang sau"
          onClick={() => goTo(current + 1)}
          disabled={current === totalPages}
        >
          <ChevronRight />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Trang cuối"
          title="Trang cuối"
          className="hidden sm:inline-flex"
          onClick={() => goTo(totalPages)}
          disabled={current === totalPages}
        >
          <ChevronsRight />
        </Button>
      </div>

      {totalPages > jumpThreshold && (
        <form
          className="flex items-center gap-2 text-xs text-muted-foreground"
          onSubmit={(e) => {
            e.preventDefault();
            submitJump();
          }}
        >
          <label htmlFor={jumpId}>Đi tới trang</label>
          <input
            id={jumpId}
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            placeholder={`1-${totalPages}`}
            className="h-8 w-20 rounded-[8px] border border-border bg-background px-2 text-center text-xs tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button type="submit" variant="outline" size="sm" disabled={jumpValue === ''}>
            Đi
          </Button>
        </form>
      )}
    </nav>
  );
}
