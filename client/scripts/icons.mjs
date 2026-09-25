import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "..", "public");
const assets = path.join(here, "..", "assets");

async function png(src, file, size, bg) {
  const base = sharp(src).resize(size, size);
  await (bg ? base.flatten({ background: bg }) : base).png().toFile(path.join(pub, file));
  console.log("wrote", file, `${size}x${size}`);
}

const logo = path.join(pub, "logo.svg");
await png(logo, "pwa-192x192.png", 192, "#ffffff");
await png(logo, "pwa-512x512.png", 512, "#ffffff");
await png(logo, "apple-touch-icon.png", 180, "#ffffff");
await png(logo, "favicon-32x32.png", 32, "#ffffff");

// Sources haute définition pour Capacitor (icône + splash).
await sharp(logo).resize(1024, 1024).png().toFile(path.join(assets, "icon.png"));
const splashLogo = await sharp(logo).resize(900, 900).png().toBuffer();
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: "#ffffff" } })
  .composite([{ input: splashLogo, gravity: "center" }])
  .png()
  .toFile(path.join(assets, "splash.png"));
console.log("wrote assets/icon.png + assets/splash.png");
