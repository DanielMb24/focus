import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { notify } from "../../lib/notify";

/** La mise à jour s'applique seule ; l'utilisateur reçoit juste une notification (interne + système). */
export function UpdatePrompt() {
  const done = useRef(false);
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (r) setInterval(() => r.update().catch(() => null), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (needRefresh && !done.current) {
      done.current = true;
      void notify("Mise à jour installée", "Focus passe à la nouvelle version…");
      setTimeout(() => updateServiceWorker(true), 2500);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
