import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  profileType: z.enum(["student", "professional", "entrepreneur"]),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const onboardingSchema = z.object({
  firstName: z.string().min(1).max(80),
  profileType: z.enum(["student", "professional", "entrepreneur"]),
  workspaceName: z.string().min(1).max(80),
  workspaceType: z.enum(["personal", "school", "work", "business"]).default("personal"),
  language: z.string().default("fr"),
  timezone: z.string().default("Europe/Paris"),
});
