# PACKAGING — `.exe` bureau & `.apk` Android

La PWA s'installe déjà en 1 clic (bureau + mobile). Ce document couvre les
**vrais binaires natifs** : ce qui est prêt, ce qui reste à faire, et où.

## 0. Prérequis commun : héberger le backend en HTTPS

Les applis natives ne peuvent pas utiliser le proxy Vite (`/api` relatif).
1. Déployez `server/` (ex. Render, Railway, VPS) avec MongoDB Atlas.
2. Côté `client/`, renseignez l'URL publique du backend :
   ```bash
   VITE_API_URL=https://votre-api.example.com
   ```
   (voir `client/.env.example` ; vide = même origine, mode web/PWA inchangé).
3. Côté `server/.env`, ajoutez l'origine de l'app à `CLIENT_URL`
   (ex. `CLIENT_URL=https://votre-app.example.com,capacitor://localhost`).
   En production le cookie refresh exige HTTPS (`Secure`, `SameSite=None`) —
   déjà géré par `secure: isProd`.
4. Limite connue : le refresh token (cookie HttpOnly) ne survit pas toujours
   au redémarrage d'une webview native → l'utilisateur se reconnecte.
   L'access token en mémoire fonctionne normalement pendant la session.

## 1. Bureau Windows — Tauri (`.exe` / `.msi`)

Préparé dans `client/src-tauri/` : `tauri.conf.json`, `Cargo.toml`, `main.rs`,
`build.rs`, capabilities minimales, jeu d'icônes complet (`.ico`, `.icns`, PNG).

Sur **votre PC Windows** :
```bash
# 1. Installer Rust (rustup) + "Desktop development with C++" (Visual Studio Build Tools)
# 2. Dans client/ :
npm run build
npx tauri build
# → client/src-tauri/target/release/Focus_0.1.0_x64-setup.exe (.msi aussi)
```
- `npm run tauri` = raccourci CLI ; `npm run tauri dev` pour le mode dev.
- **Signature / SmartScreen** : sans certificat de signature de code,
  Windows affiche un avertissement SmartScreen à l'installation.
  Options : certificat EV/OV (~200-400 €/an), ou distribution interne
  (les utilisateurs cliquent « Informations complémentaires → Exécuter »).
- La compilation Rust n'a **pas** été exécutée ici (toolchain absente) :
  le scaffold suit le gabarit officiel Tauri v2, à valider par un premier
  `npx tauri build` chez vous.

## 2. Android — Capacitor (`.apk` / `.aab`)

Préparé dans `client/` : `capacitor.config.ts` (`com.focus.productivity`,
`webDir: dist`, schéma `https`), dossier `android/` généré et synchronisé.

```bash
# Dans client/, après chaque changement web :
npm run build && npm run cap:sync
# Puis dans Android Studio : ouvrir client/android → Build > Build APK(s)
# → android/app/build/outputs/apk/debug/app-debug.apk
```
- **Release signée** : `Build > Generate Signed Bundle/APK` avec votre
  keystore (`keytool -genkeypair ...`). Sans signature, seul le mode
  debug / « sources inconnues » fonctionne.
- **Play Store** : préférez l'`.aab` release + compte développeur (25 $).
- Icônes Android : générées (`mipmap-*`) depuis `pwa-512x512.png`.
  Pour les régénérer après un nouveau logo : adaptative icons via
  Android Studio (Resource Manager), ou `npx tauri icon` + copie manuelle.

## 3. Alternative sans compilation : PWABuilder

Si l'app est hébergée en HTTPS avec le manifest valide (`dist/manifest.webmanifest`) :
1. https://www.pwabuilder.com → entrer l'URL → packages **Android (TWA)** et
   **Windows (MSIX)** générés dans le cloud, publiables sur les stores.
2. Le `share_target` et les icônes 192/512 sont déjà en place.

## 4. Fichiers concernés

| Élément | Fichier |
|---|---|
| URL API configurable | `client/src/lib/api.ts` (`API_BASE`), `upload.ts`, `files.ts`, `FileDetail.tsx`, `client/.env.example` |
| Capacitor | `client/capacitor.config.ts`, `client/android/` |
| Tauri | `client/src-tauri/` |
| Scripts | `cap:sync`, `tauri` dans `client/package.json` |
