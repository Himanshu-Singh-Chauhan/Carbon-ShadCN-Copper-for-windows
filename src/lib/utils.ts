import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix = "id") {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function formatShortcut(shortcut: string) {
  return shortcut
    .replace("CommandOrControl", "Ctrl")
    .replace("CmdOrCtrl", "Ctrl")
    .replace(/\+/g, " + ");
}

export function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest("input, textarea, [contenteditable='true'], [role='textbox']"),
  );
}
