# Focus — Plateforme de productivité (PWA SaaS)

Étudiants · Professionnels · Entrepreneurs. Tâches (+ sous-tâches), projets (+ Kanban), objectifs liés aux tâches, calendrier, notes éditables, focus timer, workspaces, palette Ctrl+K, PWA offline installable, mode sombre.

Identité : fond blanc, encre noire, bleu roi (`#1d4ed8`), Roboto.

## Stack
- Frontend : React 18 + Vite 5 + TS + Tailwind 3 + React Router 6 + TanStack Query 5 + Zustand + RHF + Zod + lucide + date-fns + dnd-kit + vite-plugin-pwa
- Backend : Node 22 + Express 4 + TS + Mongoose 8 + JWT (access/refresh rotation) + bcryptjs + Helmet + CORS + rate-limit + Zod

## Prérequis
Node 20+, MongoDB local ou Docker.

## Installation
```bash
cp .env.example .env            # renseigner MONGODB_URI + secrets JWT
npm install --prefix server && npm install --prefix client
```

## Démarrage
```bash
# Backend (MongoDB Atlas — URI déjà dans .env)
npm run dev --prefix server     # :4000
# Frontend
npm run dev --prefix client     # :5173 (proxy /api -> :4000)
```

## Fichiers & documents
- Explorateur `/files` : dossiers/sous-dossiers, import (fichiers, dossier, photo, scan → PDF), aperçu, corbeille, favoris, récents, recherche, tri, grille/liste, quotas.
- Stockage local `server/uploads` (jamais servi en public, toujours via routes authentifiées) ; abstraction `StorageProvider` prête pour S3/R2/MinIO.
- Variables : `MAX_FILE_SIZE_MB` (25), `MAX_WORKSPACE_STORAGE_MB` (1024), `STORAGE_DIR` (./uploads).
- Pièces jointes : tâches, projets (onglet Fichiers), notes, objectifs — par liaison, sans duplication.

## Docker
```bash
npm run build --prefix server
docker compose up --build
```

## Scripts
- `server`: dev / build / start / typecheck / test (vitest, base `taskmg-test`)
- `client`: dev / build / preview / typecheck

## Architecture
Voir `docs/IMPLEMENTATION_PLAN.md`. API versionnée `/api/v1`, format `{success,data,meta}` / `{success:false,error:{code,message}}`.
Auth : access Bearer 15m + refresh cookie HttpOnly 30j avec rotation (`refreshTokens`).
Frontend : Query = serveur, Zustand = UI (workspace actif, sidebar, quick-add, online).

## Parcours MVP
Register → Onboarding (prénom, profil, workspace) → Dashboard → + Nouvelle tâche (options : projet, objectif, tags, description) → Today/Tasks (filtres statut/projet/priorité/tag + recherche) → Projet + Board Kanban → Calendar → Goals (édition, progression auto) → Notes (édition) → Focus → Ctrl+K → installer PWA (menu navigateur).

## Présentation (hors application)
- `promo/parcours.html` — maquette du parcours utilisateur en 7 étapes (ouvrir dans un navigateur, imprimer en PDF si besoin).
- `promo/affiche.html` — affiche de présentation du produit.
- Ces fichiers ne sont **jamais embarqués** dans l'APK, l'exe ni le build web.

## Applis natives (`.exe` / `.apk`)
Voir **`docs/PACKAGING.md`** : API configurable (`VITE_API_URL`), projet **Capacitor/Android** prêt (`client/android`, `npm run cap:sync`), scaffold **Tauri** prêt (`client/src-tauri`, `npx tauri build` sur votre PC avec Rust). La compilation et la signature se font sur votre machine (guide pas-à-pas dans le doc).
