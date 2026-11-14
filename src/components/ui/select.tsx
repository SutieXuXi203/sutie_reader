"use client"

// Motion Prompt #053 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#053
// Dropdown (select) / ドロップダウン
// Pack: ui (UI component names) · element 05 · Category: Opening & overlays
// Spec: Open 0->1 over 250ms with easeOutCubic, drops 6px with shadow, chevron turns 180deg, field border becomes primary.
// Items highlight in light primary on hover/focus. Closes over 150ms with easeInOut.

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left transition-opacity duration-150 ease-out", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      suppressHydrationWarning
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-md border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow,border-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Motion Prompt #053: Field border becomes 2px primary, chevron rotates 180deg over 150ms easeOut
        "data-[popup-open]:border-primary data-[popup-open]:ring-2 data-[popup-open]:ring-primary/20",
        "[&_[data-slot=select-icon]>svg]:transition-transform [&_[data-slot=select-icon]>svg]:duration-150 [&_[data-slot=select-icon]>svg]:ease-out data-[popup-open]:[&_[data-slot=select-icon]>svg]:rotate-180",
        "[&_.lucide-chevron-down]:transition-transform [&_.lucide-chevron-down]:duration-150 [&_.lucide-chevron-down]:ease-out data-[popup-open]:[&_.lucide-chevron-down]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        data-slot="select-icon"
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground transition-transform duration-150 ease-out" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-(--available-height) min-w-(--anchor-width) w-auto min-w-36 max-w-[calc(100vw-2rem)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover text-popover-foreground border border-border shadow-2xl",
            // Motion Prompt #053: Open 0->1 over 150ms with easeOut, dropping 6px; closes over 100ms with easeInOut
            "data-[align-trigger=true]:animate-none motion-reduce:animate-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-98 data-open:duration-150 data-open:ease-out",
            "data-[side=bottom]:data-open:slide-in-from-top-1.5",
            "data-[side=top]:data-open:slide-in-from-bottom-1.5",
            "data-[side=inline-end]:data-open:slide-in-from-left-1.5",
            "data-[side=inline-start]:data-open:slide-in-from-right-1.5",
            "data-[side=left]:data-open:slide-in-from-right-1.5",
            "data-[side=right]:data-open:slide-in-from-left-1.5",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-98 data-closed:duration-100 data-closed:ease-in-out",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  indicatorPosition = "right",
  ...props
}: SelectPrimitive.Item.Props & {
  indicatorPosition?: "left" | "right"
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 text-sm outline-hidden select-none transition-colors duration-150",
        // Motion Prompt #053: Options highlighted in light primary tint as cursor moves
        "data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary dark:data-[highlighted]:bg-primary/20 dark:data-[highlighted]:text-primary-foreground focus:bg-primary/10 focus:text-primary dark:focus:bg-primary/20 dark:focus:text-primary-foreground not-data-[variant=destructive]:focus:**:text-primary",
        "data-[selected]:font-semibold",
        "data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        indicatorPosition === "left" ? "pl-9 pr-3" : "pr-8 pl-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        render={
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 flex size-4 items-center justify-center text-primary",
              indicatorPosition === "left" ? "left-2.5" : "right-2.5"
            )}
          />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
