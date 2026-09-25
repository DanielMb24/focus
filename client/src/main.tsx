import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter } from "./routes/router";
import { checkNativeUpdate } from "./lib/updater";
import { initTheme } from "./lib/theme";

initTheme();

// Exe Tauri : mise à jour silencieuse au démarrage (navigateurs : sans effet).
void checkNativeUpdate();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
