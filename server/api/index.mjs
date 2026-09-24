// Désactive le body-parser Vercel : multer doit recevoir le flux multipart intact.
export const config = { api: { bodyParser: false } };

function sendJson(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ success: false, error: { code: "INTERNAL", message } }));
}

// Imports dynamiques : une variable d'environnement manquante (ex. MONGODB_URI)
// produit une réponse JSON explicite au lieu d'un crash opaque au chargement.
let boot = null;
function getApp() {
  if (!boot) {
    boot = (async () => {
      const [{ createApp }, { connectDb }] = await Promise.all([
        import("../dist/app.js"),
        import("../dist/config/db.js"),
      ]);
      await connectDb();
      return createApp();
    })();
  }
  return boot;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return await app(req, res);
  } catch (e) {
    sendJson(res, 500, e instanceof Error ? e.message : "Startup failed");
  }
}
