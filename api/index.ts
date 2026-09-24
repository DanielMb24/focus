import { createApp } from "../server/src/app.js";
import { connectDb } from "../server/src/config/db.js";

// Désactive le body-parser Vercel : multer doit recevoir le flux multipart intact.
export const config = { api: { bodyParser: false } };

const app = createApp();

export default async function handler(req: unknown, res: unknown) {
  await connectDb();
  const expressHandler = app as unknown as (a: unknown, b: unknown) => unknown;
  return expressHandler(req, res);
}
