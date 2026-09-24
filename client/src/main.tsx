import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter } from "./routes/router";

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
