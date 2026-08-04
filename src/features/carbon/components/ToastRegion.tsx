import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Icon } from "../../../components/ui/icon";
import { cn } from "../../../lib/utils";
import type { ToastMessage } from "../types";

export function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed bottom-16 left-1/2 z-[90] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 flex-col items-center gap-2"
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
          {toast.action && (
            <button
              type="button"
              className="pointer-events-auto ml-1 cursor-pointer rounded-lg px-1.5 py-1 text-xs font-semibold text-accent outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
