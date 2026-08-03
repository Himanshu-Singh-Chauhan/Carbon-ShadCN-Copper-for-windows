import { useEffect, useRef } from "react";
import { getDataPath, loadDocument, saveDocument } from "../../../lib/native";
import {
  getCarbonDocument,
  useCarbonStore,
} from "../../../lib/store";
import type { Notify } from "../types";

export function useCarbonPersistence({
  hydrated,
  hydrate,
  notify,
  onDataPath,
}: {
  hydrated: boolean;
  hydrate: ReturnType<typeof useCarbonStore.getState>["hydrate"];
  notify: Notify;
  onDataPath: (path: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadDocument(), getDataPath()])
      .then(([document, path]) => {
        if (cancelled) return;
        hydrate(document);
        onDataPath(path);
        void saveDocument(document);
      })
      .catch((error) => {
        hydrate(useCarbonStore.getState());
        notify(`Could not load Carbon data: ${String(error)}`, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, notify, onDataPath]);

  useEffect(() => {
    if (!hydrated) return;
    const unsubscribe = useCarbonStore.subscribe((state, previous) => {
      if (
        state.sections === previous.sections &&
        state.activeSectionId === previous.activeSectionId &&
        state.settings === previous.settings
      ) {
        return;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveDocument(getCarbonDocument()).catch((error) =>
          notify(`Could not save changes: ${String(error)}`, "error"),
        );
      }, 180);
    });
    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, notify]);
}
