import { useEffect } from "react";
import type { Theme } from "../../../lib/model";

export function useTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);
}
