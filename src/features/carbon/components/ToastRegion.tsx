import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Icon } from "../../../components/ui/icon";
import { cn } from "../../../lib/utils";
import type { ToastMessage } from "../types";

export function ToastRegion({ toasts }: { toasts: ToastMessage[] }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          className={cn(
            "flex max-w-full items-center gap-2 rounded-xl border bg-surface-raised px-3 py-2 text-xs font-medium text-ink shadow-float",
            toast.kind === "error" ? "border-danger/25" : "border-line",
          )}
          key={toast.id}
        >
          <Icon
            className={cn(
              toast.kind === "error" ? "text-danger" : "text-accent",
              toast.kind === "loading" && "animate-spin",
            )}
            icon={
              toast.kind === "error"
                ? Cancel01Icon
                : toast.kind === "loading"
                  ? Loading03Icon
                : CheckmarkCircle02Icon
            }
            size={15}
          />
          <span className="min-w-0 break-words">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
