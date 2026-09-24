import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as c from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

export const authRouter = Router();
authRouter.post("/register", authLimiter, c.register);
authRouter.post("/login", authLimiter, c.login);
authRouter.post("/refresh", c.refresh);
authRouter.post("/logout", c.logout);
authRouter.get("/me", requireAuth, c.me);
authRouter.patch("/me", requireAuth, c.updateMe);
authRouter.post("/onboarding", requireAuth, c.onboarding);
