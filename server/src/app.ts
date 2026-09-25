import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { securityHeaders } from "./middleware/security.js";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { workspaceRouter } from "./modules/workspaces/workspace.routes.js";
import { projectRouter } from "./modules/projects/project.routes.js";
import { taskRouter } from "./modules/tasks/task.routes.js";
import { goalRouter, noteRouter, focusRouter } from "./modules/goals/misc.routes.js";
import { fileRouter } from "./modules/files/file.routes.js";
import { folderRouter } from "./modules/files/folder.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.use(securityHeaders);
  // Origines normalisées : espaces, slash final et caractères invisibles
  // issus d'un copier-coller dashboard neutralisés.
  const origins = env.CLIENT_URL.split(",")
    .map((o) => o.replace(/[\s\u200B-\u200F\uFEFF]/g, "").replace(/\/$/, "").toLowerCase())
    .filter(Boolean);
  console.log(`CORS origins: ${origins.join(",") || "(none)"}`);
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok", time: new Date().toISOString() } }));
  app.get("/", (_req, res) =>
    res.json({ success: true, data: { name: "Focus API", version: "0.1.0", health: "/health", auth: "/api/v1/auth/me" } })
  );

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/workspaces", workspaceRouter);
  v1.use("/projects", projectRouter);
  v1.use("/tasks", taskRouter);
  v1.use("/goals", goalRouter);
  v1.use("/notes", noteRouter);
  v1.use("/focus", focusRouter);
  v1.use("/files", fileRouter);
  v1.use("/folders", folderRouter);
  v1.use("/search", searchRouter);
  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
