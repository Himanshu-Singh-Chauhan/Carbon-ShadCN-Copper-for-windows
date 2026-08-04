import { useCallback, useRef, useState } from "react";
import type { ToastMessage } from "../types";

export function useAppToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const notify = useCallback(
    (message: string, kind: ToastMessage["kind"] = "default") => {
      const id = ++toastId.current;
      setToasts((current) => [...current.slice(-2), { id, message, kind }]);
      window.setTimeout(
        () => setToasts((current) => current.filter((toast) => toast.id !== id)),
        2600,
      );
    },
    [],
  );

  const notifyWithAction = useCallback(
    (message: string, label: string, onClick: () => void) => {
      const id = ++toastId.current;
      setToasts((current) => [
        ...current.slice(-2),
        { id, message, action: { label, onClick } },
      ]);
      window.setTimeout(
        () => setToasts((current) => current.filter((toast) => toast.id !== id)),
        5000,
      );
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return {
    dismissToast,
    notify,
    notifyWithAction,
    setToasts,
    toastId,
    toasts,
  };
}
