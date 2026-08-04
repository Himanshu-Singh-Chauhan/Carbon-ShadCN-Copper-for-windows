import { fetchDroppedImage } from "../../lib/native";
import { CARBON_INTERNAL_DRAG_TYPE } from "../../lib/dragTypes";

type DropSnapshot = {
  files: File[];
  html: string;
  plainText: string;
  uriList: string;
  downloadUrl: string;
};

export type DroppedContent = {
  images: File[];
  imageRequested: boolean;
  text: string;
};

function snapshot(data: DataTransfer): DropSnapshot {
  return {
    files: Array.from(data.files),
    html: data.getData("text/html"),
    plainText: data.getData("text/plain"),
    uriList: data.getData("text/uri-list"),
    downloadUrl: data.getData("DownloadURL"),
  };
}

function firstUri(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
}

function imageUrlFromHtml(html: string, fallbackUrl?: string) {
  if (!html) return undefined;
  const document = new DOMParser().parseFromString(html, "text/html");
  const source = document.querySelector("img")?.getAttribute("src")?.trim();
  if (!source) return undefined;
  try {
    return new URL(source, fallbackUrl).toString();
  } catch {
    return source.startsWith("data:image/") ? source : undefined;
  }
}

function imageUrlFromDownload(value: string) {
  const match = value.match(/^image\/[^:]+:[^:]*:(.+)$/s);
  return match?.[1]?.trim();
}

function hasImageExtension(value?: string) {
  if (!value) return false;
  try {
    return /\.(?:bmp|gif|jpe?g|png|webp)(?:$|[?#])/i.test(
      new URL(value).pathname,
    );
  } catch {
    return false;
  }
}

function looksLikeImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    /\.(?:bmp|gif|jpe?g|png|webp)$/i.test(file.name)
  );
}

function detectImageMimeType(bytes: Uint8Array) {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(1, 3) === "PNG"
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(ascii(0, 6))) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 2 && ascii(0, 2) === "BM") {
    return "image/bmp";
  }
  throw new Error("This image format is not supported.");
}

function imageFileName(url: string, mimeType: string) {
  const extension = {
    "image/bmp": "bmp",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[mimeType];
  try {
    const name = new URL(url).pathname.split("/").pop();
    if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  } catch {
    // Data URLs have no useful filename.
  }
  return `dropped-image.${extension ?? "png"}`;
}

async function imageFileFromUrl(url: string) {
  const bytes = url.startsWith("data:image/")
    ? new Uint8Array(await (await fetch(url)).arrayBuffer())
    : await fetchDroppedImage(url);
  const mimeType = detectImageMimeType(bytes);
  return new File([bytes], imageFileName(url, mimeType), { type: mimeType });
}

async function normalizeImageFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageMimeType(bytes);
  if (file.type === mimeType) return file;
  return new File([bytes], file.name || imageFileName("", mimeType), {
    type: mimeType,
    lastModified: file.lastModified,
  });
}

export function isInternalCarbonDrag(data: DataTransfer) {
  return Array.from(data.types).includes(CARBON_INTERNAL_DRAG_TYPE);
}

export function supportsDrop(data: DataTransfer) {
  if (isInternalCarbonDrag(data)) return false;
  const types = Array.from(data.types);
  return types.some((type) =>
    ["Files", "text/plain", "text/uri-list", "text/html", "DownloadURL"].includes(
      type,
    ),
  );
}

export function requestsImageDrop(data: DataTransfer) {
  if (isInternalCarbonDrag(data)) return false;
  if (
    Array.from(data.items).some(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    ) ||
    Array.from(data.files).some(looksLikeImageFile)
  ) {
    return true;
  }
  const fallbackUrl = firstUri(data.getData("text/uri-list"));
  return Boolean(
    imageUrlFromHtml(data.getData("text/html"), fallbackUrl) ||
      imageUrlFromDownload(data.getData("DownloadURL")) ||
      hasImageExtension(fallbackUrl),
  );
}

export async function resolveDroppedContent(data: DataTransfer) {
  const captured = snapshot(data);
  const images = await Promise.all(
    captured.files.filter(looksLikeImageFile).map(normalizeImageFile),
  );
  const fallbackUrl =
    firstUri(captured.uriList) || captured.plainText.trim() || undefined;
  const remoteImageUrl =
    imageUrlFromHtml(captured.html, fallbackUrl) ||
    imageUrlFromDownload(captured.downloadUrl) ||
    (hasImageExtension(fallbackUrl) ? fallbackUrl : undefined);
  const imageRequested = images.length > 0 || Boolean(remoteImageUrl);

  if (images.length === 0 && remoteImageUrl) {
    images.push(await imageFileFromUrl(remoteImageUrl));
  }

  return {
    images,
    imageRequested,
    text: imageRequested ? "" : captured.plainText.trim() || firstUri(captured.uriList) || "",
  } satisfies DroppedContent;
}
