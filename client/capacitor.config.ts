import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.focus.productivity",
  appName: "Focus",
  webDir: "dist",
  // Schéma https : requis pour les cookies/SameSite=None et le service worker.
  server: { androidScheme: "https" },
};

export default config;
