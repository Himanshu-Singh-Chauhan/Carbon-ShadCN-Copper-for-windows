import { invoke } from "@tauri-apps/api/core";
import type { CarbonDocument } from "./model";
import { normalizeDocument } from "./model";

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

export async function showCaptureNotification(message = "Captured") {
  if (!isTauri()) return;
  await invoke("show_capture_notification", { message });
}

export async function quitApp() {
  if (!isTauri()) return;
  await invoke("quit_app");
}
