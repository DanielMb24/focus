import { Router } from "express";
import * as c from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";

export const authRouter = Router();
authRouter.post("/register", authLimiter, c.register);
authRouter.post("/login", authLimiter, c.login);
authRouter.post("/refresh", c.refresh);
authRouter.post("/logout", c.logout);
authRouter.get("/me", requireAuth, c.me);
authRouter.patch("/me", requireAuth, c.updateMe);
authRouter.post("/onboarding", requireAuth, c.onboarding);
