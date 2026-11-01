import "./polyfills";
import "@fontsource-variable/inter";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { registerDownloadServiceWorker } from "./lib/download/stream";

void registerDownloadServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);