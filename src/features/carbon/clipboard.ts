import {
  readImage,
  readText,
} from "@tauri-apps/plugin-clipboard-manager";
import type { CarbonAttachment } from "../../lib/model";
import { isTauri, saveImageAsset } from "../../lib/native";
import { createId } from "../../lib/utils";
import type { DraftImage } from "./types";

export function imageFilesFromClipboard(data: DataTransfer) {
  return Array.from(data.files).filter((file) =>
    file.type.startsWith("image/"),
  );
}

async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

export async function createDraftImage(file: File): Promise<DraftImage> {
  return {
    id: createId("attachment"),
    file,
    previewUrl: URL.createObjectURL(file),
    ...(await imageDimensions(file)),
  };
}

export async function saveImageFile(
  file: File,
  id = createId("attachment"),
): Promise<CarbonAttachment> {
  const dimensions = await imageDimensions(file);
  return {
    id,
    path: await saveImageAsset(
      id,
      file.type,
      new Uint8Array(await file.arrayBuffer()),
    ),
    mimeType: file.type,
    ...dimensions,
  };
}

async function nativeClipboardImage() {
  const image = await readImage();
  try {
    const [rgba, size] = await Promise.all([image.rgba(), image.size()]);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image conversion is unavailable.");
    context.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), size.width, size.height),
      0,
      0,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("Could not encode image.")),
        "image/png",
      );
    });
    return new File([blob], "clipboard.png", { type: "image/png" });
  } finally {
    await image.close();
  }
}

export async function readSystemClipboard() {
  if (isTauri()) {
    const [textResult, imageResult] = await Promise.allSettled([
      readText(),
      nativeClipboardImage(),
    ]);
    return {
      text: textResult.status === "fulfilled" ? textResult.value : "",
      images:
        imageResult.status === "fulfilled" ? [imageResult.value] : [],
    };
  }

  const images: File[] = [];
  if (navigator.clipboard.read) {
    const entries = await navigator.clipboard.read();
    for (const entry of entries) {
      for (const type of entry.types.filter((value) =>
        value.startsWith("image/"),
      )) {
        const blob = await entry.getType(type);
        images.push(new File([blob], "clipboard-image", { type }));
      }
    }
  }
  const text = await navigator.clipboard.readText().catch(() => "");
  return { text, images };
}
