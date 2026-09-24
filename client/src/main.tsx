import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter } from "./routes/router";
import { checkNativeUpdate } from "./lib/updater";

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") document.documentElement.classList.add("dark");

// Exe Tauri : mise à jour silencieuse au démarrage (navigateurs : sans effet).
void checkNativeUpdate();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
