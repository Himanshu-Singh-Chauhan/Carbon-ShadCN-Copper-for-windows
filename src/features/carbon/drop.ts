import { fetchDroppedImage } from "../../lib/native";
import { CARBON_INTERNAL_DRAG_TYPE } from "../../lib/dragTypes";
import type { CarbonImageOrigin } from "../../lib/model";

type DropSnapshot = {
  files: File[];
  html: string;
  plainText: string;
  uriList: string;
  downloadUrl: string;
  mozUrl: string;
};

export type DroppedImage = CarbonImageOrigin & {
  file: File;
};

export type DroppedContent = {
  images: DroppedImage[];
  imageRequested: boolean;
  text: string;
  unsupportedFiles: boolean;
};

function snapshot(data: DataTransfer): DropSnapshot {
  return {
    files: Array.from(data.files),
    html: data.getData("text/html"),
    plainText: data.getData("text/plain"),
    uriList: data.getData("text/uri-list"),
    downloadUrl: data.getData("DownloadURL"),
    mozUrl: data.getData("text/x-moz-url"),
  };
}

function firstUri(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
}

function httpUrl(value?: string, base?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return /^https?:$/i.test(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sourceUrlFromHtmlPayload(html: string) {
  return html.match(/(?:^|\r?\n)SourceURL:(https?:\/\/[^\r\n]+)/i)?.[1];
}

type HtmlText = {
  hasList: boolean;
  text: string;
};

function textFromHtml(html: string): HtmlText {
  if (!html) return { hasList: false, text: "" };
  const document = new DOMParser().parseFromString(html, "text/html");
  const ignoredTags = new Set(["IMG", "NOSCRIPT", "SCRIPT", "STYLE"]);
  const blockTags = new Set([
    "ARTICLE",
    "BLOCKQUOTE",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "SECTION",
  ]);

  const renderNodes = (nodes: NodeListOf<ChildNode> | ChildNode[], depth: number) =>
    Array.from(nodes)
      .map((node) => renderNode(node, depth))
      .join("");

  const renderList = (list: Element, depth: number): string => {
    const ordered = list.tagName === "OL";
    const items = Array.from(list.children).filter(
      (child) => child.tagName === "LI",
    );
    return items
      .map((item, index) => {
        const nestedLists: Element[] = [];
        const directNodes = Array.from(item.childNodes).filter((node) => {
          if (
            node instanceof Element &&
            (node.tagName === "UL" || node.tagName === "OL")
          ) {
            nestedLists.push(node);
            return false;
          }
          return true;
        });
        const itemText = renderNodes(directNodes, depth)
          .replace(/\s*\n+\s*/g, " ")
          .replace(/[ \t]{2,}/g, " ")
          .trim();
        const marker = ordered ? `${index + 1}. ` : "- ";
        const line = `${"  ".repeat(depth)}${marker}${itemText}`;
        const nested = nestedLists
          .map((nestedList) => renderList(nestedList, depth + 1))
          .filter(Boolean)
          .join("\n");
        return nested ? `${line}\n${nested}` : line;
      })
      .join("\n");
  };

  const renderNode = (node: ChildNode, depth: number): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue?.replace(/\s+/g, " ") ?? "";
    }
    if (!(node instanceof Element) || ignoredTags.has(node.tagName)) return "";
    if (node.tagName === "BR") return "\n";
    if (node.tagName === "UL" || node.tagName === "OL") {
      return `\n${renderList(node, depth)}\n`;
    }
    if (node.tagName === "PRE") {
      const code = node.textContent?.trim();
      return code ? `\n\`\`\`\n${code}\n\`\`\`\n` : "";
    }
    const content = renderNodes(node.childNodes, depth);
    return blockTags.has(node.tagName) ? `\n${content.trim()}\n` : content;
  };

  return {
    hasList: Boolean(document.body.querySelector("ul, ol")),
    text: renderNodes(document.body.childNodes, 0)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

type DetectedImage = CarbonImageOrigin & {
  fetchUrl: string;
};

function imagesFromHtml(html: string, fallbackUrl?: string): DetectedImage[] {
  if (!html) return [];
  const document = new DOMParser().parseFromString(html, "text/html");
  const payloadPageUrl = httpUrl(sourceUrlFromHtmlPayload(html));
  const baseUrl = payloadPageUrl ?? httpUrl(fallbackUrl);
  const seen = new Set<string>();
  return Array.from(document.querySelectorAll("img")).flatMap((image) => {
    const source = image.getAttribute("src")?.trim();
    if (!source) return [];
    try {
      const fetchUrl = new URL(source, baseUrl).toString();
      if (seen.has(fetchUrl)) return [];
      seen.add(fetchUrl);
      const linkedPageUrl = httpUrl(
        image.closest<HTMLAnchorElement>("a[href]")?.getAttribute("href") ??
          undefined,
        baseUrl,
      );
      return [
        {
          fetchUrl,
          sourceUrl: httpUrl(fetchUrl),
          pageUrl:
            linkedPageUrl ??
            payloadPageUrl ??
            (httpUrl(fallbackUrl) !== httpUrl(fetchUrl)
              ? httpUrl(fallbackUrl)
              : undefined),
        },
      ];
    } catch {
      if (!source.startsWith("data:image/") || seen.has(source)) return [];
      seen.add(source);
      return [{ fetchUrl: source }];
    }
  });
}

function imageFromHtml(html: string, fallbackUrl?: string) {
  return imagesFromHtml(html, fallbackUrl)[0];
}

function imageFromDownload(value: string): DetectedImage | undefined {
  const match = value.match(/^image\/[^:]+:[^:]*:(.+)$/s);
  const fetchUrl = match?.[1]?.trim();
  return fetchUrl
    ? { fetchUrl, sourceUrl: httpUrl(fetchUrl) }
    : undefined;
}

function isOnlyDetectedImageUrl(value: string, detected?: DetectedImage) {
  const url = httpUrl(value.trim());
  if (!url || !detected) return false;
  return [detected.fetchUrl, detected.sourceUrl, detected.pageUrl]
    .map((candidate) => httpUrl(candidate))
    .some((candidate) => candidate === url);
}

function droppedText(captured: DropSnapshot, detected?: DetectedImage) {
  const htmlText = textFromHtml(captured.html);
  if (htmlText.hasList && htmlText.text) return htmlText.text;

  const plainText = captured.plainText.trim();
  if (plainText && !isOnlyDetectedImageUrl(plainText, detected)) {
    return plainText;
  }
  if (htmlText.text) return htmlText.text;

  const fallbackUrl =
    firstUri(captured.uriList) || firstUri(captured.mozUrl) || "";
  return isOnlyDetectedImageUrl(fallbackUrl, detected) ? "" : fallbackUrl;
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
    [
      "Files",
      "text/plain",
      "text/uri-list",
      "text/x-moz-url",
      "text/html",
      "DownloadURL",
    ].includes(type),
  );
}

export function hasStructuredHtmlText(data: DataTransfer) {
  const html = data.getData("text/html");
  if (!html) return false;
  const document = new DOMParser().parseFromString(html, "text/html");
  return Boolean(document.body.querySelector("ul, ol"));
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
  const fallbackUrl =
    firstUri(data.getData("text/uri-list")) ||
    firstUri(data.getData("text/x-moz-url")) ||
    data.getData("text/plain").trim() ||
    undefined;
  return Boolean(
    imageFromHtml(data.getData("text/html"), fallbackUrl) ||
      imageFromDownload(data.getData("DownloadURL")) ||
      hasImageExtension(fallbackUrl),
  );
}

export function imageOriginFromTransfer(data: DataTransfer): CarbonImageOrigin {
  const captured = snapshot(data);
  const fallbackUrl =
    firstUri(captured.uriList) ||
    firstUri(captured.mozUrl) ||
    captured.plainText.trim() ||
    undefined;
  const detected =
    imageFromHtml(captured.html, fallbackUrl) ||
    imageFromDownload(captured.downloadUrl) ||
    (hasImageExtension(fallbackUrl) && fallbackUrl
      ? {
          fetchUrl: fallbackUrl,
          sourceUrl: httpUrl(fallbackUrl),
        }
      : undefined);
  return {
    sourceUrl: detected?.sourceUrl,
    pageUrl: detected?.pageUrl,
  };
}

export async function resolveDroppedContent(data: DataTransfer) {
  const captured = snapshot(data);
  const normalizedFiles = await Promise.all(
    captured.files.filter(looksLikeImageFile).map(normalizeImageFile),
  );
  const fallbackUrl =
    firstUri(captured.uriList) ||
    firstUri(captured.mozUrl) ||
    captured.plainText.trim() ||
    undefined;
  const htmlImages = imagesFromHtml(captured.html, fallbackUrl);
  const fallbackImage =
    imageFromDownload(captured.downloadUrl) ||
    (hasImageExtension(fallbackUrl) && fallbackUrl
      ? {
          fetchUrl: fallbackUrl,
          sourceUrl: httpUrl(fallbackUrl),
        }
      : undefined);
  const detectedImages =
    htmlImages.length > 0
      ? htmlImages
      : fallbackImage
        ? [fallbackImage]
        : [];
  const detectedImage = detectedImages[0];
  const imageRequested =
    normalizedFiles.length > 0 || detectedImages.length > 0;
  const images: DroppedImage[] = normalizedFiles.map((file, index) => ({
    file,
    sourceUrl: detectedImages[index]?.sourceUrl ?? detectedImage?.sourceUrl,
    pageUrl: detectedImages[index]?.pageUrl ?? detectedImage?.pageUrl,
  }));

  const remoteImages = await Promise.allSettled(
    detectedImages.slice(normalizedFiles.length).map(async (detected) => ({
      file: await imageFileFromUrl(detected.fetchUrl),
      sourceUrl: detected.sourceUrl,
      pageUrl: detected.pageUrl,
    })),
  );
  images.push(
    ...remoteImages.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    ),
  );

  return {
    images,
    imageRequested,
    text:
      captured.files.length > 0 && images.length === 0
        ? ""
        : droppedText(captured, detectedImage),
    unsupportedFiles: captured.files.length > 0 && images.length === 0,
  } satisfies DroppedContent;
}
