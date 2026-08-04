import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { Icon } from "./icon";

const itemStyles =
  "relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-hover data-[state=open]:bg-surface-hover [&>svg]:shrink-0 [&>svg]:text-muted";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  collisionPadding = 12,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        className={cn(
          "z-[70] min-w-52 overflow-hidden rounded-xl border border-line bg-surface-raised p-1.5 text-ink shadow-float outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(itemStyles, inset && "pl-8", className)}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  children,
  className,
  checked,
  indicatorSide = "left",
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  indicatorSide?: "left" | "right";
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        itemStyles,
        indicatorSide === "right" ? "pr-8" : "pl-8",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className={cn(
          "absolute inline-flex size-4 items-center justify-center text-accent",
          indicatorSide === "right" ? "right-2" : "left-2",
        )}
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.2} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  children,
  className,
  indicatorSide = "left",
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  indicatorSide?: "left" | "right";
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        itemStyles,
        indicatorSide === "right" ? "pr-8" : "pl-8",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute inline-flex size-4 items-center justify-center text-accent",
          indicatorSide === "right" ? "right-2" : "left-2",
        )}
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.2} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-faint",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("-mx-0.5 my-1.5 h-px bg-line", className)}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="ml-auto pl-4 text-xs font-medium tracking-wide text-faint">
      {children}
    </span>
  );
}

export function DropdownMenuSubTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(itemStyles, className)}
      {...props}
    >
      {children}
      <Icon
        className="ml-auto text-faint"
        icon={ArrowRight01Icon}
        size={14}
      />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  sideOffset = 6,
  collisionPadding = 12,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(
        "z-[70] min-w-44 overflow-hidden rounded-xl border border-line bg-surface-raised p-1.5 text-ink shadow-float outline-none",
        className,
      )}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      {...props}
    />
  );
}
