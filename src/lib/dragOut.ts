import { Channel, invoke } from "@tauri-apps/api/core";
import type { DragEvent } from "react";
import { CARBON_INTERNAL_DRAG_TYPE } from "./dragTypes";

interface NativeDragResult {
  result: "Dropped" | "Cancel";
  cursorPos: { x: number; y: number };
}

const IMAGE_DRAG_PREVIEW_MAX_WIDTH = 144;
const IMAGE_DRAG_PREVIEW_MAX_HEIGHT = 96;

function createImageDragPreview(image?: HTMLImageElement | null) {
  const loadedImage =
    image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0
      ? image
      : undefined;
  const scale = loadedImage
    ? Math.min(
        IMAGE_DRAG_PREVIEW_MAX_WIDTH / loadedImage.naturalWidth,
        IMAGE_DRAG_PREVIEW_MAX_HEIGHT / loadedImage.naturalHeight,
        1,
      )
    : 1;
  const width = loadedImage
    ? Math.max(1, Math.round(loadedImage.naturalWidth * scale))
    : 96;
  const height = loadedImage
    ? Math.max(1, Math.round(loadedImage.naturalHeight * scale))
    : 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return "";

  if (loadedImage) {
    context.drawImage(loadedImage, 0, 0, width, height);
  } else {
    context.fillStyle = "#27272a";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#a1a1aa";
    context.lineWidth = 4;
    context.strokeRect(18, 14, 60, 44);
  }
  return canvas.toDataURL("image/png");
}

export function prepareTextDrag(
  event: DragEvent<HTMLElement>,
  text: string,
) {
  const value = text.trim();
  if (!value) {
    event.preventDefault();
    return;
  }

  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("text/plain", value);
  event.dataTransfer.setData(CARBON_INTERNAL_DRAG_TYPE, "1");

  const preview = document.createElement("div");
  preview.className =
    "fixed -left-[10000px] top-0 w-64 overflow-hidden rounded-xl border border-line bg-surface-raised px-3 py-2 text-sm leading-5 text-ink shadow-float";
  preview.textContent =
    value.length > 180 ? `${value.slice(0, 177).trimEnd()}…` : value;
  document.body.append(preview);
  event.dataTransfer.setDragImage(preview, 20, 18);
  window.setTimeout(() => preview.remove(), 0);
}

export async function startImageDrag(
  path: string,
  imageElement?: HTMLImageElement | null,
) {
  const preview = createImageDragPreview(imageElement);
  const absolutePath = await invoke<string>("resolve_image_asset_path", {
    path,
  });
  const onEvent = new Channel<NativeDragResult>();
  onEvent.onmessage = () => {};
  await invoke("plugin:drag|start_drag", {
    item: [absolutePath],
    image: preview || absolutePath,
    options: { mode: "copy" },
    onEvent,
  });
}
