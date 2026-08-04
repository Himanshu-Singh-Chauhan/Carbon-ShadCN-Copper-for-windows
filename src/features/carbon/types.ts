import type { CarbonImageOrigin } from "../../lib/model";

export type ToastMessage = {
  id: number;
  message: string;
  kind?: "default" | "error" | "loading";
  action?: {
    label: string;
    onClick: () => void;
  };
};

export type Notify = (
  message: string,
  kind?: ToastMessage["kind"],
) => void;

export type ContextMenuState = {
  x: number;
  y: number;
  itemId: string;
  itemIds: string[];
  target: "item" | "source";
} | null;

export type DraftImage = CarbonImageOrigin & {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
};
