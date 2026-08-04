import ReactDOM from "react-dom/client";
import { CaptureToast } from "./components/CaptureToast";
import "./styles/globals.css";

document.body.className = "bg-transparent";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <CaptureToast />,
);
