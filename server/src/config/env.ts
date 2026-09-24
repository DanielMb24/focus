import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: "../.env" });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  MONGODB_URI: required("MONGODB_URI", "mongodb://localhost:27017/productivity"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev-access-secret-please-change-32chars"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-refresh-secret-please-change-32chars"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  // Coût bcrypt : 10 = ~100 ms (serverless hobby), 12+ = hosts dédiés.
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? 10),
  CLIENT_URL: process.env.CLIENT_URL ?? "https://mytsak.vercel.app,https://localhost,capacitor://localhost,tauri://localhost",
  MAX_FILE_SIZE_MB: Number(process.env.MAX_FILE_SIZE_MB ?? 25),
  MAX_WORKSPACE_STORAGE_MB: Number(process.env.MAX_WORKSPACE_STORAGE_MB ?? 1024),
  STORAGE_DIR: process.env.STORAGE_DIR ?? "./uploads",
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER ?? "local",
  isProd: (process.env.NODE_ENV ?? "development") === "production",
};
