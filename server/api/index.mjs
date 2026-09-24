import { createApp } from "../dist/app.js";
import { connectDb } from "../dist/config/db.js";

// Désactive le body-parser Vercel : multer doit recevoir le flux multipart intact.
export const config = { api: { bodyParser: false } };

const app = createApp();

export default async function handler(req, res) {
  await connectDb();
  return app(req, res);
}
