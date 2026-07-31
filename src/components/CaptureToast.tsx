import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CaptureToast() {
  const [message, setMessage] = useState("Captured");
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("capture-notification", ({ payload }) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(payload);
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));
      timer.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => void getCurrentWindow().hide(), 160);
      }, 1450);
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      unlisten?.();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <main
      className={
        visible
          ? "capture-toast-window capture-toast-window--visible"
          : "capture-toast-window"
      }
    >
      <div className="capture-toast-icon">
        <Check size={15} strokeWidth={3} />
      </div>
      <span>{message}</span>
    </main>
  );
}
