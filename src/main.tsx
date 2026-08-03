import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { CaptureToast } from "./components/CaptureToast";
import { ImageViewer } from "./components/ImageViewer";
import "./styles/globals.css";

const windowLabel =
  "__TAURI_INTERNALS__" in window ? getCurrentWindow().label : "main";

if (windowLabel === "capture-toast") {
  document.body.className = "bg-transparent";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  windowLabel === "capture-toast" ? (
    <CaptureToast />
  ) : windowLabel === "image-viewer" ? (
    <ImageViewer />
  ) : (
    <App />
  ),
);
