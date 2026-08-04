import { useEffect } from "react";
import { rememberForegroundSource } from "../externalInputSource";

export function useExternalInputSource(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;

    function rememberAfterBlur() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void rememberForegroundSource(true);
      }, 200);
    }

    window.addEventListener("blur", rememberAfterBlur);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", rememberAfterBlur);
    };
  }, [enabled]);
}
