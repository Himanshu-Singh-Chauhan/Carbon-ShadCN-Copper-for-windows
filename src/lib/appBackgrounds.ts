import scenicFlowersUrl from "../assets/backgrounds/scenic-flowers.png";
import type { BuiltInAppBackground } from "./model";

export const appBackgrounds: {
  value: BuiltInAppBackground;
  label: string;
  imageUrl?: string;
}[] = [
  { value: "none", label: "None" },
  {
    value: "scenic-flowers",
    label: "Scenic flowers",
    imageUrl: scenicFlowersUrl,
  },
];

export function getAppBackgroundUrl(background: string) {
  return appBackgrounds.find(({ value }) => value === background)?.imageUrl;
}
