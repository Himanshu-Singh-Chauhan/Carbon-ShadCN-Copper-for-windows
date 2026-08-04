import type { CarbonItemSource } from "../../lib/model";
import { captureForegroundSource } from "../../lib/native";

let rememberedSource: CarbonItemSource | undefined;
let sourceRequestVersion = 0;
let appliedSourceVersion = 0;
const sourceRequests = new Set<Promise<CarbonItemSource | undefined>>();

export function rememberForegroundSource(clearOnMiss = false) {
  const requestVersion = ++sourceRequestVersion;
  const request = captureForegroundSource()
    .then((source) => {
      if (source && requestVersion >= appliedSourceVersion) {
        rememberedSource = source;
        appliedSourceVersion = requestVersion;
      } else if (
        !source &&
        clearOnMiss &&
        requestVersion === sourceRequestVersion
      ) {
        rememberedSource = undefined;
        appliedSourceVersion = requestVersion;
      }
      return rememberedSource;
    })
    .catch(() => rememberedSource);
  sourceRequests.add(request);
  void request.finally(() => {
    sourceRequests.delete(request);
  });
  return request;
}

export async function getRememberedSource(pageUrl?: string) {
  if (sourceRequests.size > 0) {
    await Promise.allSettled(Array.from(sourceRequests));
  }
  if (!rememberedSource) return undefined;
  if (pageUrl && rememberedSource.appName === "File Explorer") {
    return undefined;
  }
  return {
    ...rememberedSource,
    pageUrl: pageUrl ?? rememberedSource.pageUrl,
  };
}
