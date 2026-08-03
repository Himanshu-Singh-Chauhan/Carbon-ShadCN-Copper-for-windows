import { useEffect } from "react";
import {
  configureDoublePressShortcuts,
  isTauri,
} from "../../../lib/native";
import { doublePressModifier } from "../../../lib/utils";
import type { Notify } from "../types";

export function useDoublePressShortcuts({
  captureHotkey,
  enabled,
  hydrated,
  notify,
  showWindowHotkey,
}: {
  captureHotkey: string;
  enabled: boolean;
  hydrated: boolean;
  notify: Notify;
  showWindowHotkey: string;
}) {
  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    void configureDoublePressShortcuts(
      enabled ? doublePressModifier(captureHotkey) : null,
      enabled ? doublePressModifier(showWindowHotkey) : null,
    ).catch((error) =>
      notify(`Double-tap shortcut unavailable: ${String(error)}`, "error"),
    );
  }, [captureHotkey, enabled, hydrated, notify, showWindowHotkey]);
}
