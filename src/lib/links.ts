const HTTP_URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

export type TextPart =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string };

function cleanUrl(value: string) {
  let url = value.replace(TRAILING_PUNCTUATION, "");
  while (
    (url.endsWith(")") && url.split("(").length < url.split(")").length) ||
    (url.endsWith("]") && url.split("[").length < url.split("]").length) ||
    (url.endsWith("}") && url.split("{").length < url.split("}").length)
  ) {
    url = url.slice(0, -1);
  }
  return url;
}

export function extractHttpUrls(text: string) {
  return Array.from(text.matchAll(HTTP_URL_PATTERN), (match) =>
    cleanUrl(match[0]),
  ).filter((url, index, urls) => url && urls.indexOf(url) === index);
}

export function splitTextByLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(HTTP_URL_PATTERN)) {
    const matched = match[0];
    const url = cleanUrl(matched);
    const index = match.index ?? cursor;
    if (index > cursor) {
      parts.push({ kind: "text", value: text.slice(cursor, index) });
    }
    parts.push({ kind: "link", value: url });
    const trailing = matched.slice(url.length);
    if (trailing) parts.push({ kind: "text", value: trailing });
    cursor = index + matched.length;
  }
  if (cursor < text.length) {
    parts.push({ kind: "text", value: text.slice(cursor) });
  }
  return parts;
}
