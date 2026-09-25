import { Router } from "express";
import * as c from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter, verifyLimiter } from "../../middleware/rateLimit.js";

export const authRouter = Router();
authRouter.post("/register", authLimiter, c.register);
authRouter.post("/login", authLimiter, c.login);
authRouter.post("/refresh", c.refresh);
authRouter.post("/logout", c.logout);
authRouter.post("/verify-email", verifyLimiter, c.verifyEmail);
authRouter.post("/resend-code", verifyLimiter, c.resendCode);
authRouter.post("/forgot-password", verifyLimiter, c.forgotPassword);
authRouter.post("/reset-password", verifyLimiter, c.resetPassword);
authRouter.get("/me", requireAuth, c.me);
authRouter.patch("/me", requireAuth, c.updateMe);
authRouter.patch("/password", requireAuth, c.changePassword);
authRouter.post("/onboarding", requireAuth, c.onboarding);
