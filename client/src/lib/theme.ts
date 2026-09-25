export type ThemeChoice = "light" | "dark" | "system";

const KEY = "theme";
let mediaListener: (() => void) | null = null;

export function currentThemeChoice(): ThemeChoice {
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "system" ? v : "light";
}

function resolvedDark(choice: ThemeChoice): boolean {
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applique le thème ; en mode système, suit l'appareil en direct. */
export function applyTheme(choice: ThemeChoice): void {
  localStorage.setItem(KEY, choice);
  document.documentElement.classList.toggle("dark", resolvedDark(choice));
  if (mediaListener) {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", mediaListener as EventListener);
    mediaListener = null;
  }
  if (choice === "system") {
    const onChange = () => document.documentElement.classList.toggle("dark", resolvedDark("system"));
    mediaListener = onChange;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onChange);
  }
}

/** À appeler au démarrage (main.tsx). */
export function initTheme(): void {
  applyTheme(currentThemeChoice());
}
