import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "danger";
  size?: "default" | "sm" | "icon";
};

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-accent/35 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
        {
          "border-accent bg-accent text-accent-foreground shadow-sm hover:border-accent-strong hover:bg-accent-strong":
            variant === "default",
          "border-transparent bg-transparent text-muted hover:bg-surface-hover hover:text-ink":
            variant === "ghost",
          "border-line bg-surface-raised text-ink shadow-sm hover:border-line-strong hover:bg-surface-hover":
            variant === "outline",
          "border-danger bg-danger text-white hover:brightness-95":
            variant === "danger",
          "h-10 px-4": size === "default",
          "h-8 px-3 text-xs": size === "sm",
          "size-9 p-0": size === "icon",
        },
        className,
      )}
      {...props}
    />
  );
}
