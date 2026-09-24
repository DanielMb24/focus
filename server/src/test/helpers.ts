import mongoose from "mongoose";
import { env } from "../config/env.js";

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
