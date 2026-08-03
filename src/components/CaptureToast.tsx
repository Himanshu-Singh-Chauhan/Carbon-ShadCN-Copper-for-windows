import {
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  InboxIcon,
} from "@hugeicons/core-free-icons";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CaptureNotificationPayload } from "../lib/native";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Icon } from "./ui/icon";
import { Toaster } from "./ui/sonner";

function CaptureNotification({
  onComplete,
  onMenuOpenChange,
  payload,
  toastId,
}: {
  onComplete: () => void;
  onMenuOpenChange: (open: boolean) => void;
  payload: CaptureNotificationPayload;
  toastId: string | number;
}) {
  const [bucketId, setBucketId] = useState(payload.bucketId);
  const [menuOpen, setMenuOpen] = useState(false);
  const bucketName =
    payload.buckets.find((bucket) => bucket.id === bucketId)?.name ?? "Inbox";

  async function selectBucket(nextBucketId: string) {
    setBucketId(nextBucketId);
    await emitTo("main", "captured-item-bucket-changed", {
      itemId: payload.itemId,
      bucketId: nextBucketId,
    });
    toast.dismiss(toastId);
    onComplete();
  }

  function setBucketMenuOpen(open: boolean) {
    onMenuOpenChange(open);
    setMenuOpen(open);
  }

  return (
    <div className="flex w-[336px] items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3 shadow-float">
      <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon icon={CheckmarkCircle02Icon} size={19} strokeWidth={2.4} />
      </div>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-ink">
          {payload.message}
        </strong>
        <span className="mt-0.5 block text-xs text-muted">Saved to</span>
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setBucketMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 max-w-32 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-muted outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35 data-[state=open]:bg-surface-hover"
            aria-label={`Change bucket. Currently ${bucketName}`}
          >
            <Icon className="shrink-0" icon={InboxIcon} size={14} />
            <span className="truncate">{bucketName}</span>
            <Icon className="shrink-0" icon={ArrowDown01Icon} size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="max-h-64 min-w-44 overflow-y-auto"
          side="top"
          align="end"
          sideOffset={8}
        >
          <DropdownMenuRadioGroup
            value={bucketId}
            onValueChange={(value) => void selectBucket(value)}
          >
            {payload.buckets.map((bucket) => (
              <DropdownMenuRadioItem value={bucket.id} key={bucket.id}>
                {bucket.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CaptureToast() {
  const activeItemIds = useRef(new Set<string>());
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);

  useEffect(() => {
    const toaster = document.querySelector<HTMLElement>("[data-sonner-toaster]");
    if (!toaster) return;
    if (openMenuItemId === null) {
      toaster.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      return;
    }
    const timer = window.setTimeout(() => {
      toaster.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openMenuItemId]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    function completeNotification(itemId: string) {
      activeItemIds.current.delete(itemId);
      setOpenMenuItemId((current) => (current === itemId ? null : current));
      if (activeItemIds.current.size === 0) {
        window.setTimeout(() => void getCurrentWindow().hide(), 180);
      }
    }

    async function showPendingNotifications() {
      const payloads = await invoke<CaptureNotificationPayload[]>(
        "take_capture_notifications",
      );
      if (cancelled) return;
      for (const payload of payloads) {
        activeItemIds.current.add(payload.itemId);
        toast.custom(
          (toastId) => (
            <CaptureNotification
              key={payload.itemId}
              onComplete={() => completeNotification(payload.itemId)}
              onMenuOpenChange={(open) =>
                setOpenMenuItemId((current) =>
                  open
                    ? payload.itemId
                    : current === payload.itemId
                      ? null
                      : current,
                )
              }
              payload={payload}
              toastId={toastId}
            />
          ),
          {
            id: `capture-notification-${payload.itemId}`,
            duration: 6000,
            unstyled: true,
            onAutoClose: () => completeNotification(payload.itemId),
            onDismiss: () => completeNotification(payload.itemId),
          },
        );
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void showPendingNotifications();
      }
    }

    void listen("capture-notification-ready", () => {
      void showPendingNotifications();
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void showPendingNotifications();

    return () => {
      cancelled = true;
      unlisten?.();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <main className="h-full w-full bg-transparent">
      <Toaster
        expand={openMenuItemId !== null}
        gap={8}
        offset={12}
        toastOptions={{ className: "!p-0 !bg-transparent !border-0 !shadow-none" }}
      />
    </main>
  );
}
