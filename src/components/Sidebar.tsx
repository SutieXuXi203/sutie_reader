"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { cn } from "@/lib/utils";

export type SidebarItemState =
  | "default"
  | "active"
  | "disabled"
  | "loading"
  | "error";

export type SidebarEntry =
  | {
      type: "divider";
      id: string;
    }
  | {
      type?: "item";
      id: string;
      label: string;
      href?: string;
      onSelect?: () => void;
      icon?: LucideIcon;
      state?: SidebarItemState;
    };

export interface SidebarProps {
  entries: SidebarEntry[];
  variant?: "default" | "collapsed";
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  footer?: React.ReactNode;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

type SidebarInteractiveElement = HTMLAnchorElement | HTMLButtonElement;

const SIDEBAR_STYLE_VARS = {
  fontFamily: "var(--wukong-font-family-primary)",
  "--sidebar-font-size-base": "var(--wukong-font-size-base)",
  "--sidebar-font-size-sm": "var(--wukong-font-size-sm)",
  "--sidebar-font-weight-base": "var(--wukong-font-weight-base)",
  "--sidebar-color-surface-base": "var(--wukong-color-surface-base)",
  "--sidebar-color-surface-muted": "var(--wukong-color-surface-muted)",
  "--sidebar-color-text-tertiary": "var(--wukong-color-text-tertiary)",
  "--sidebar-color-text-secondary": "var(--wukong-color-text-secondary)",
  "--sidebar-color-text-inverse": "var(--wukong-color-text-inverse)",
  "--sidebar-space-1": "var(--wukong-space-1)",
  "--sidebar-space-2": "var(--wukong-space-2)",
  "--sidebar-width-expanded":
    "calc((var(--sidebar-space-2) * 18) + var(--sidebar-space-1))",
  "--sidebar-width-collapsed":
    "calc((var(--sidebar-space-2) * 4) + var(--sidebar-space-1))",
} as CSSProperties;

const isNavigationItem = (
  entry: SidebarEntry
): entry is Extract<SidebarEntry, { type?: "item" }> => entry.type !== "divider";

const isNonInteractiveState = (state: SidebarItemState) =>
  state === "disabled" || state === "loading";

export function Sidebar({
  entries,
  variant = "default",
  mobileOpen = false,
  onMobileOpenChange,
  footer,
  title = "Navigation",
  ariaLabel = "Primary navigation",
  className,
}: SidebarProps) {
  const itemRefs = useRef<Record<string, SidebarInteractiveElement | null>>({});
  const isCollapsed = variant === "collapsed";

  const navigationItems = useMemo(
    () => entries.filter(isNavigationItem),
    [entries]
  );

  const focusableItemIds = useMemo(
    () =>
      navigationItems
        .filter((item) => !isNonInteractiveState(item.state ?? "default"))
        .map((item) => item.id),
    [navigationItems]
  );

  const registerItemRef = useCallback(
    (id: string, node: SidebarInteractiveElement | null) => {
      itemRefs.current[id] = node;
    },
    []
  );

  const closeMobileSidebar = useCallback(() => {
    onMobileOpenChange?.(false);
  }, [onMobileOpenChange]);

  const moveFocus = useCallback(
    (direction: "first" | "last" | 1 | -1) => {
      if (focusableItemIds.length === 0) {
        return;
      }

      const currentId =
        (document.activeElement as HTMLElement | null)?.dataset.sidebarItemId ??
        "";
      const currentIndex = focusableItemIds.indexOf(currentId);
      let nextIndex = 0;

      if (direction === "first") {
        nextIndex = 0;
      } else if (direction === "last") {
        nextIndex = focusableItemIds.length - 1;
      } else if (currentIndex < 0) {
        nextIndex = direction === 1 ? 0 : focusableItemIds.length - 1;
      } else {
        nextIndex =
          (currentIndex + direction + focusableItemIds.length) %
          focusableItemIds.length;
      }

      const nextId = focusableItemIds[nextIndex];
      itemRefs.current[nextId]?.focus();
    },
    [focusableItemIds]
  );

  const handleListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(1);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(-1);
      }

      if (event.key === "Home") {
        event.preventDefault();
        moveFocus("first");
      }

      if (event.key === "End") {
        event.preventDefault();
        moveFocus("last");
      }
    },
    [moveFocus]
  );

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const keydownListener = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileSidebar();
      }
    };

    window.addEventListener("keydown", keydownListener);
    return () => window.removeEventListener("keydown", keydownListener);
  }, [mobileOpen, closeMobileSidebar]);

  useEffect(() => {
    if (!mobileOpen || focusableItemIds.length === 0) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      itemRefs.current[focusableItemIds[0]]?.focus();
    });

    return () => window.cancelAnimationFrame(raf);
  }, [mobileOpen, focusableItemIds]);

  const renderSidebarContent = (collapsedView: boolean, isMobileView: boolean) => (
    <>
      <div
        className={cn(
          "flex items-center border-b border-[color:var(--sidebar-color-text-secondary)]",
          "px-[var(--sidebar-space-2)] py-[var(--sidebar-space-2)]"
        )}
      >
        <p
          className={cn(
            "font-normal text-[length:var(--sidebar-font-size-base)] text-[color:var(--sidebar-color-text-tertiary)]",
            collapsedView ? "sr-only" : "truncate"
          )}
        >
          {title}
        </p>
        {isMobileView ? (
          <button
            type="button"
            onClick={closeMobileSidebar}
            aria-label="Close sidebar"
            className={cn(
              "ml-auto inline-flex h-9 w-9 items-center justify-center rounded-[8px]",
              "text-[color:var(--sidebar-color-text-tertiary)] transition-colors",
              "hover:bg-[color:var(--sidebar-color-surface-muted)] hover:text-[color:var(--sidebar-color-surface-base)]",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-[color:var(--sidebar-color-surface-muted)] focus-visible:ring-offset-2",
              "focus-visible:ring-offset-[color:var(--sidebar-color-surface-base)]"
            )}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <nav
        className="flex-1 overflow-y-auto px-[var(--sidebar-space-1)] py-[var(--sidebar-space-1)]"
        aria-label={ariaLabel}
      >
        {navigationItems.length === 0 ? (
          <p
            className={cn(
              "rounded-[8px] border border-[color:var(--sidebar-color-text-secondary)]",
              "px-[var(--sidebar-space-2)] py-[var(--sidebar-space-2)]",
              "text-[length:var(--sidebar-font-size-sm)] font-normal text-[color:var(--sidebar-color-text-tertiary)]"
            )}
          >
            No navigation available
          </p>
        ) : (
          <ul
            role="list"
            onKeyDown={handleListKeyDown}
            className="space-y-[var(--sidebar-space-1)]"
          >
            {entries.map((entry) => {
              if (entry.type === "divider") {
                return (
                  <li
                    key={entry.id}
                    role="separator"
                    aria-orientation="horizontal"
                    className="my-[var(--sidebar-space-1)] border-t border-[color:var(--sidebar-color-text-secondary)]"
                  />
                );
              }

              const itemState = entry.state ?? "default";
              const isItemDisabled = isNonInteractiveState(itemState);
              const isActive = itemState === "active";
              const Icon = entry.icon;
              const iconFallback = entry.label.slice(0, 1).toUpperCase();

              const itemClassName = cn(
                "group relative flex w-full items-center rounded-[8px] border border-transparent",
                "px-[var(--sidebar-space-2)] py-[var(--sidebar-space-1)] text-left",
                "font-normal text-[length:var(--sidebar-font-size-base)] leading-normal",
                "text-[color:var(--sidebar-color-text-tertiary)] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sidebar-color-surface-muted)]",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--sidebar-color-surface-base)]",
                "hover:bg-[color:var(--sidebar-color-surface-muted)] hover:text-[color:var(--sidebar-color-surface-base)]",
                "data-[item-state=active]:bg-[color:var(--sidebar-color-surface-muted)]",
                "data-[item-state=active]:text-[color:var(--sidebar-color-surface-base)]",
                "data-[item-state=disabled]:cursor-not-allowed data-[item-state=disabled]:opacity-55",
                "data-[item-state=disabled]:hover:bg-transparent data-[item-state=disabled]:hover:text-[color:var(--sidebar-color-text-tertiary)]",
                "data-[item-state=loading]:cursor-wait data-[item-state=loading]:opacity-85",
                "data-[item-state=error]:border-[color:var(--sidebar-color-text-inverse)]",
                "data-[item-state=error]:bg-[color:var(--sidebar-color-surface-muted)]",
                "data-[item-state=error]:text-[color:var(--sidebar-color-surface-base)]",
                collapsedView ? "justify-center px-[var(--sidebar-space-1)]" : "gap-[var(--sidebar-space-2)]"
              );

              const onClick = (
                event: ReactMouseEvent<SidebarInteractiveElement>
              ) => {
                if (isItemDisabled) {
                  event.preventDefault();
                  return;
                }

                entry.onSelect?.();
                if (isMobileView) {
                  closeMobileSidebar();
                }
              };

              const onKeyDown = (
                event: ReactKeyboardEvent<SidebarInteractiveElement>
              ) => {
                if (event.key === "Enter" && isItemDisabled) {
                  event.preventDefault();
                }
              };

              const statusIcon =
                itemState === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : itemState === "error" ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                ) : null;

              const content = (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-[5px] top-[5px] bottom-[5px] w-[2px] rounded-full bg-transparent",
                      itemState === "active" || itemState === "error"
                        ? "bg-[color:var(--sidebar-color-text-inverse)]"
                        : ""
                    )}
                  />
                  <span
                    aria-hidden
                    className="relative z-10 inline-flex h-5 w-5 flex-none items-center justify-center text-[color:var(--sidebar-color-text-secondary)] group-data-[item-state=active]:text-[color:var(--sidebar-color-surface-base)] group-data-[item-state=error]:text-[color:var(--sidebar-color-surface-base)]"
                  >
                    {Icon ? <Icon className="h-5 w-5" aria-hidden /> : iconFallback}
                  </span>
                  <span
                    className={cn(
                      "relative z-10 min-w-0 truncate",
                      collapsedView ? "sr-only" : "flex-1"
                    )}
                  >
                    {entry.label}
                  </span>
                  {statusIcon ? (
                    <span
                      aria-hidden
                      className={cn(
                        "relative z-10 text-[color:var(--sidebar-color-text-secondary)]",
                        collapsedView ? "absolute right-[7px]" : "ml-auto"
                      )}
                    >
                      {statusIcon}
                    </span>
                  ) : null}
                  {itemState === "loading" ? (
                    <span className="sr-only">Loading</span>
                  ) : null}
                  {itemState === "error" ? (
                    <span className="sr-only">Error</span>
                  ) : null}
                </>
              );

              if (entry.href && !isItemDisabled) {
                return (
                  <li key={entry.id}>
                    <Link
                      ref={(node) => registerItemRef(entry.id, node)}
                      href={entry.href}
                      data-item-state={itemState}
                      data-sidebar-item-id={entry.id}
                      className={itemClassName}
                      aria-current={isActive ? "page" : undefined}
                      aria-invalid={itemState === "error" ? true : undefined}
                      aria-label={collapsedView ? entry.label : undefined}
                      title={collapsedView ? entry.label : undefined}
                      onClick={onClick}
                      onKeyDown={onKeyDown}
                    >
                      {content}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={entry.id}>
                  <button
                    ref={(node) => registerItemRef(entry.id, node)}
                    type="button"
                    data-item-state={itemState}
                    data-sidebar-item-id={entry.id}
                    className={itemClassName}
                    aria-current={isActive ? "page" : undefined}
                    aria-busy={itemState === "loading" ? true : undefined}
                    aria-invalid={itemState === "error" ? true : undefined}
                    aria-disabled={isItemDisabled ? true : undefined}
                    aria-label={collapsedView ? entry.label : undefined}
                    title={collapsedView ? entry.label : undefined}
                    tabIndex={isItemDisabled ? -1 : 0}
                    disabled={isItemDisabled}
                    onClick={onClick}
                    onKeyDown={onKeyDown}
                  >
                    {content}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {footer ? (
        <footer
          className={cn(
            "border-t border-[color:var(--sidebar-color-text-secondary)]",
            "px-[var(--sidebar-space-2)] py-[var(--sidebar-space-2)]",
            "text-[length:var(--sidebar-font-size-sm)] font-normal text-[color:var(--sidebar-color-text-tertiary)]"
          )}
        >
          {footer}
        </footer>
      ) : null}
    </>
  );

  return (
    <>
      <aside
        style={SIDEBAR_STYLE_VARS}
        className={cn(
          "hidden md:flex md:h-screen md:flex-col",
          "bg-[color:var(--sidebar-color-surface-base)] text-[color:var(--sidebar-color-text-tertiary)]",
          "border-r border-[color:var(--sidebar-color-text-secondary)]",
          isCollapsed
            ? "md:w-[var(--sidebar-width-collapsed)]"
            : "md:w-[var(--sidebar-width-expanded)]",
          className
        )}
      >
        {renderSidebarContent(isCollapsed, false)}
      </aside>

      <div
        style={SIDEBAR_STYLE_VARS}
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={mobileOpen ? undefined : true}
      >
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={closeMobileSidebar}
          className={cn(
            "absolute inset-0 bg-[color:var(--sidebar-color-surface-base)] transition-opacity",
            mobileOpen ? "opacity-70" : "opacity-0"
          )}
        />
        <aside
          className={cn(
            "relative z-10 h-full w-[var(--sidebar-width-expanded)] max-w-[85vw] border-r",
            "border-[color:var(--sidebar-color-text-secondary)]",
            "bg-[color:var(--sidebar-color-surface-base)] text-[color:var(--sidebar-color-text-tertiary)] transition-transform",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {renderSidebarContent(false, true)}
        </aside>
      </div>
    </>
  );
}
