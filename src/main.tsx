import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { CaptureToast } from "./components/CaptureToast";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  "__TAURI_INTERNALS__" in window &&
    getCurrentWindow().label === "capture-toast" ? (
    <CaptureToast />
  ) : (
    <App />
  ),
);
