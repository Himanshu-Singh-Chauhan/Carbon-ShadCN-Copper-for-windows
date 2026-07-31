import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

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
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        className={cn("dialog-content", className)}
        {...props}
      >
        <div className="dialog-heading">
          <div>
            <DialogPrimitive.Title className="dialog-title">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="dialog-description">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close asChild>
            <ButtonLikeIcon label="Close">
              <X size={16} />
            </ButtonLikeIcon>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function ButtonLikeIcon({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <button className="icon-button" type="button" aria-label={label}>
      {children}
    </button>
  );
}
