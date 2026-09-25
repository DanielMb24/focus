import mongoose from "mongoose";
import { env } from "../config/env.js";
import { mailOutbox } from "../modules/mail/mailer.js";

export function testDbUri(): string {
  const u = new URL(env.MONGODB_URI);
  u.pathname = "/taskmg-test";
  return u.toString();
}

export async function connectTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testDbUri());
  }
}

export async function clearTestDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (db) await db.dropDatabase();
}

export async function closeTestDb(): Promise<void> {
  await mongoose.disconnect();
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
}

interface TestAgent {
  post(url: string): { send(body: object): Promise<{ body: { data: { accessToken: string } } }> };
}

/** Inscrit un utilisateur puis vérifie son email via la boîte de sortie (sans SMTP). */
export async function registerVerifiedUser(
  agent: TestAgent,
  profile: string = "professional",
  firstName = "Test"
): Promise<{ email: string; token: string }> {
  const email = uniqueEmail("verified");
  const reg = await agent.post("/api/v1/auth/register").send({ firstName, email, password: "Password123!", profileType: profile });
  const code = /(\d{6})/.exec(mailOutbox[mailOutbox.length - 1]?.html ?? "")?.[1] ?? "";
  if (!code) throw new Error("Verification code not found in outbox");
  const verify = await agent.post("/api/v1/auth/verify-email").send({ email, code });
  if (!verify.body.data.accessToken) throw new Error("Verification failed");
  return { email, token: verify.body.data.accessToken as string };
}
