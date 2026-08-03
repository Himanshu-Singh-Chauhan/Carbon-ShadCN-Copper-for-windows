import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { CarbonAttachment, CarbonDocument } from "./model";
import { normalizeDocument } from "./model";

export interface CaptureNotificationPayload {
  message: string;
  itemId: string;
  bucketId: string;
  buckets: Array<{ id: string; name: string }>;
}

export interface ImageViewerPayload {
  attachments: CarbonAttachment[];
  index: number;
  itemId?: string;
}

export interface LinkPreviewPayload {
  url: string;
  title: string;
  description?: string;
  siteName: string;
  imagePath?: string;
  imageMimeType?: string;
}

export function isTauri() {
  return "__TAURI_INTERNALS__" in window;
}

export async function loadDocument() {
  if (!isTauri()) {
    const value = localStorage.getItem("carbon.preview.document");
    return normalizeDocument(value ? JSON.parse(value) : null);
  }
  return normalizeDocument(await invoke<CarbonDocument>("load_carbon_data"));
}

export async function saveDocument(document: CarbonDocument) {
  if (!isTauri()) {
    localStorage.setItem("carbon.preview.document", JSON.stringify(document));
    return;
  }
  await invoke("save_carbon_data", { document });
}

export async function getDataPath() {
  if (!isTauri()) return "Browser preview · localStorage";
  return invoke<string>("get_data_file_path");
}

export async function showMainWindow() {
  if (!isTauri()) return;
  await invoke("show_main_window");
}

export async function configureDoublePressShortcuts(
  capture: "shift" | "control" | "alt" | null,
  showWindow: "shift" | "control" | "alt" | null,
) {
  if (!isTauri()) return;
  await invoke("configure_double_press_shortcuts", { capture, showWindow });
}

export async function chooseDataPath(document: CarbonDocument) {
  if (!isTauri()) return null;
  return invoke<string | null>("choose_data_file", { document });
}

export async function revealDataFile() {
  if (!isTauri()) return;
  await invoke("reveal_data_file");
}

export async function captureSelectedText() {
  if (!isTauri()) return "";
  return invoke<string>("capture_selected_text");
}

export async function showCaptureNotification(
  payload: CaptureNotificationPayload,
) {
  if (!isTauri()) return;
  await invoke("show_capture_notification", { payload });
}

export async function saveImageAsset(
  id: string,
  mimeType: string,
  bytes: Uint8Array,
) {
  if (!isTauri()) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(new Blob([bytes], { type: mimeType }));
    });
  }
  return invoke<string>("save_image_asset", {
    id,
    mimeType,
    bytes: Array.from(bytes),
  });
}

export async function readImageAsset(path: string) {
  if (!isTauri()) {
    const response = await fetch(path);
    return new Uint8Array(await response.arrayBuffer());
  }
  const value = await invoke<ArrayBuffer>("read_image_asset", { path });
  return new Uint8Array(value);
}

const linkPreviewRequests = new Map<
  string,
  Promise<LinkPreviewPayload | null>
>();

export function getLinkPreview(url: string) {
  if (!isTauri()) return Promise.resolve(null);
  let request = linkPreviewRequests.get(url);
  if (!request) {
    request = invoke<LinkPreviewPayload | null>("get_link_preview", { url }).catch(
      () => null,
    );
    linkPreviewRequests.set(url, request);
  }
  return request;
}

export async function readLinkPreviewImage(path: string) {
  if (!isTauri()) return new Uint8Array();
  const value = await invoke<ArrayBuffer>("read_link_preview_image", { path });
  return new Uint8Array(value);
}

export async function openExternalUrl(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS links can be opened.");
  }
  if (isTauri()) {
    await openUrl(parsed.toString());
  } else {
    window.open(parsed.toString(), "_blank", "noopener,noreferrer");
  }
}

export async function copyImageAsset(path: string) {
  if (!isTauri()) return;
  await invoke("copy_image_asset", { path });
}

export async function copyItemsToClipboardHistory(
  images: CarbonAttachment[],
  texts: string[],
) {
  if (isTauri()) {
    return invoke<number>("copy_items_to_clipboard_history", {
      imagePaths: images.map((image) => image.path),
      texts,
    });
  }

  const pause = () => new Promise((resolve) => window.setTimeout(resolve, 700));
  let copied = 0;
  for (const image of images) {
    const bytes = await readImageAsset(image.path);
    await navigator.clipboard.write([
      new ClipboardItem({
        [image.mimeType]: new Blob([bytes], { type: image.mimeType }),
      }),
    ]);
    copied += 1;
    await pause();
  }
  for (const text of texts) {
    await navigator.clipboard.writeText(text);
    copied += 1;
    await pause();
  }
  return copied;
}

export async function trashImageAsset(
  itemId: string,
  attachmentId: string,
  path: string,
) {
  if (!isTauri()) return;
  await invoke("trash_image_asset", { itemId, attachmentId, path });
}

export async function showImageViewer(payload: ImageViewerPayload) {
  if (!isTauri()) return;
  await invoke("show_image_viewer", { payload });
}

export async function takeImageViewerPayload() {
  if (!isTauri()) return null;
  return invoke<ImageViewerPayload | null>("take_image_viewer_payload");
}

export async function quitApp() {
  if (!isTauri()) return;
  await invoke("quit_app");
}
