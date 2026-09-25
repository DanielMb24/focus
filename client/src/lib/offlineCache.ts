import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { queryClient } from "./queryClient";
import { APP_VERSION } from "./version";

/**
 * Persistance du cache serveur sur l'appareil : après un premier chargement,
 * tâches/projets/fichiers restent consultables hors connexion, même après
 * redémarrage. Le cache est invalidé à chaque version (buster).
 * Les écritures hors-ligne passent par la file de `offline.ts`.
 */
export function initOfflinePersistence(): void {
  try {
    const persister = createSyncStoragePersister({ storage: window.localStorage, key: "focus-query-cache" });
    void persistQueryClient({ queryClient, persister, maxAge: 7 * 24 * 3600 * 1000, buster: APP_VERSION });
  } catch {
    /* stockage indisponible (navigation privée stricte) : l'app reste en mémoire */
  }
}
