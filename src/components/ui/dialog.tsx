import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Icon } from "./icon";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  children: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-40 cursor-default rounded-2xl bg-black/45 backdrop-blur-[2px]"
        data-no-window-drag
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-x-hidden overflow-y-auto rounded-2xl border border-line bg-surface-raised p-4 text-ink shadow-float outline-none",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-sm font-semibold tracking-[-0.015em]">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm leading-5 text-muted">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            type="button"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-transparent text-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
            aria-label="Close"
          >
            <Icon icon={Cancel01Icon} size={17} strokeWidth={2} />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
