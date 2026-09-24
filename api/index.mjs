import { createApp } from "../server/dist/app.js";
import { connectDb } from "../server/dist/config/db.js";

// Désactive le body-parser Vercel : multer doit recevoir le flux multipart intact.
export const config = { api: { bodyParser: false } };

const app = createApp();

export default async function handler(req, res) {
  await connectDb();
  return app(req, res);
}
