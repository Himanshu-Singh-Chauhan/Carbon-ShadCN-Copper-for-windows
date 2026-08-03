import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Copy01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  copyImageAsset,
  takeImageViewerPayload,
  trashImageAsset,
  type ImageViewerPayload,
} from "../lib/native";
import { useAssetUrl } from "./AssetImage";
import { Icon } from "./ui/icon";
import { Toaster } from "./ui/sonner";

export function ImageViewer() {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [payload, setPayload] = useState<ImageViewerPayload | null>(null);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const attachment = payload?.attachments[payload.index];
  const imageUrl = useAssetUrl(attachment);

  const receivePayload = useCallback(async () => {
    const next = await takeImageViewerPayload();
    if (!next || next.attachments.length === 0) return;
    setPayload({
      ...next,
      index: Math.max(0, Math.min(next.index, next.attachments.length - 1)),
    });
    setTransform({ scale: 1, x: 0, y: 0 });
    setCopying(false);
    setDeleting(false);
  }, []);

  useEffect(() => {
    void receivePayload();
    const unlisten = listen("image-viewer-ready", receivePayload);
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [receivePayload]);

  const move = useCallback((amount: number) => {
    setPayload((current) => {
      if (!current) return current;
      const length = current.attachments.length;
      return { ...current, index: (current.index + amount + length) % length };
    });
    setTransform({ scale: 1, x: 0, y: 0 });
    setCopying(false);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const bounds = stage!.getBoundingClientRect();
      const cursorX = event.clientX - bounds.left - bounds.width / 2;
      const cursorY = event.clientY - bounds.top - bounds.height / 2;
      setTransform((current) => {
        const scale = Math.min(
          8,
          Math.max(1, current.scale * Math.exp(-event.deltaY * 0.0015)),
        );
        if (scale === 1) return { scale: 1, x: 0, y: 0 };
        const ratio = scale / current.scale;
        return {
          scale,
          x: cursorX - (cursorX - current.x) * ratio,
          y: cursorY - (cursorY - current.y) * ratio,
        };
      });
    }

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [attachment?.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (deleting) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, move]);

  async function copyCurrentImage() {
    if (!attachment || copying || deleting) return;
    setCopying(true);
    const notification = toast.loading("Copying image…");
    try {
      await copyImageAsset(attachment.path);
      toast.success("Image copied", { id: notification });
    } catch (error) {
      toast.error(`Couldn’t copy image: ${String(error)}`, {
        id: notification,
      });
    } finally {
      setCopying(false);
    }
  }

  async function deleteCurrentImage() {
    if (!payload?.itemId || !attachment || deleting) return;
    setDeleting(true);
    const notification = toast.loading("Moving image to Recycle Bin…");
    try {
      await trashImageAsset(payload.itemId, attachment.id, attachment.path);
      const attachments = payload.attachments.filter(
        (candidate) => candidate.id !== attachment.id,
      );
      toast.success("Image moved to Recycle Bin", { id: notification });
      setTransform({ scale: 1, x: 0, y: 0 });
      if (attachments.length === 0) {
        setPayload(null);
        window.setTimeout(() => void getCurrentWindow().hide(), 350);
      } else {
        setPayload({
          ...payload,
          attachments,
          index: Math.min(payload.index, attachments.length - 1),
        });
      }
    } catch (error) {
      toast.error(`Couldn’t delete image: ${String(error)}`, {
        id: notification,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (!payload || !attachment) {
    return <main className="h-full bg-[#0d0d0d]" />;
  }

  const hasGroup = payload.attachments.length > 1;
  const navStyles =
    "absolute top-1/2 z-10 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md outline-none transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white/40";

  return (
    <main className="flex h-full flex-col bg-[#0d0d0d] text-white">
      <div
        className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden"
        ref={stageRef}
      >
        {hasGroup && (
          <button
            type="button"
            className={`${navStyles} left-5`}
            disabled={deleting}
            onClick={() => move(-1)}
            aria-label="Previous image"
          >
            <Icon icon={ArrowLeft01Icon} size={24} />
          </button>
        )}
        {imageUrl ? (
          <img
            className="max-h-full max-w-full object-contain will-change-transform"
            src={imageUrl}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
            alt={`Image ${payload.index + 1} of ${payload.attachments.length}`}
          />
        ) : (
          <div className="text-sm text-white/55">Loading image…</div>
        )}
        {hasGroup && (
          <button
            type="button"
            className={`${navStyles} right-5`}
            disabled={deleting}
            onClick={() => move(1)}
            aria-label="Next image"
          >
            <Icon icon={ArrowRight01Icon} size={24} />
          </button>
        )}
      </div>
      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-white/10 bg-black/60 px-5 backdrop-blur-md">
        <span className="text-xs text-white/55">
          Image {payload.index + 1} of {payload.attachments.length}
        </span>
        <div className="flex items-center gap-2">
          {payload.itemId && (
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 text-xs font-medium text-red-300 outline-none transition-colors hover:bg-red-500/20 focus-visible:ring-2 focus-visible:ring-red-400/35 disabled:opacity-45"
            disabled={deleting || copying}
              onClick={() => void deleteCurrentImage()}
            >
              <Icon icon={Delete02Icon} size={16} />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-medium text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/35 disabled:opacity-45"
            disabled={copying || deleting}
            onClick={() => void copyCurrentImage()}
          >
            <Icon icon={Copy01Icon} size={16} />
            {copying ? "Copying…" : "Copy image"}
          </button>
        </div>
      </footer>
      <Toaster position="top-center" />
    </main>
  );
}
