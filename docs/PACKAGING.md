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
#    ⚠️ SANS le workload C++ (link.exe), la compilation est impossible —
#    vérifié le 24/09/2026 : absent, à installer via VS Installer.
# 2. Dans client/ :
npm run build
npx tauri build
# → client/src-tauri/target/release/Focus_0.1.0_x64-setup.exe (.msi aussi)
```
- Le bouton « Télécharger pour Windows » (Paramètres → Application mobile
  & bureau) apparaît dès que `VITE_EXE_URL` est renseignée.
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
# Puis compilation APK (JDK 21 requis, ex. Temurin portable) :
cd android
$env:JAVA_HOME = "<chemin JDK 21>"
./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```
- ✅ **APK déjà compilé le 24/09/2026** : `client/android/app/build/outputs/apk/debug/app-debug.apk` (4,4 Mo, debug, clé auto).
  Installation : copiez-le sur le téléphone (USB/Drive/Bluetooth) → ouvrez-le → autorisez « sources inconnues ».
- **Release signée** : `Build > Generate Signed Bundle/APK` avec votre
  keystore (`keytool -genkeypair ...`). Sans signature, seul le mode
  debug / « sources inconnues » fonctionne.
- **Play Store** : préférez l'`.aab` release + compte développeur (25 $).
- **Bouton dans l'app** : Paramètres → « Application mobile & bureau »
  affiche « Télécharger l'APK » dès que `VITE_APK_URL` est renseignée
  (ex. URL d'une GitHub Release).
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
