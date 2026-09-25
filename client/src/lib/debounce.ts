import { useEffect, useState } from "react";

/** Retarde une valeur (recherche : évite une requête par frappe). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
