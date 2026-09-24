import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: {
    // Resync au retour sur l'app : plusieurs appareils partagent la même
    // base Atlas, l'onglet actif se remet à jour automatiquement.
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
  },
});
