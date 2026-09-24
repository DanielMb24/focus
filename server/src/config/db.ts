import mongoose from "mongoose";
import { env } from "./env.js";

/** Connexion mise en cache : réutilisée entre invocations serverless (Vercel). */
export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) return;
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  console.log("MongoDB connected");
}
