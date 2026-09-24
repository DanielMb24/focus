# DÉPLOIEMENT — 2 projets Vercel (frontend + API)

Architecture retenue (canonique Vercel pour monorepo) : **un projet Vercel
par workspace**. L'ancien projet unique à la racine doit être supprimé du
dashboard (c'est lui qui produisait l'erreur d'orchestration `fsPath`).

## Projet 1 — `focus-web` (frontend)

- Vercel → Add New Project → repo `focus`.
- **Root Directory : `client`** · Framework : Vite · Build : `npm run build` · Output : `dist`.
- `client/vercel.json` (fallback SPA) et `client/.vercelignore`
  (exclut `android/`, `src-tauri/`, `dist/`) sont déjà en place.
- **Env** : `VITE_API_URL` = URL publique du projet API
  (ex. `https://focus-api.vercel.app`). Vide = même origine (dev local).

## Projet 2 — `focus-api` (backend serverless)

- Vercel → Add New Project → **même repo** `focus`.
- **Root Directory : `server`** · Framework : Other · Build : `npm run build`
  (pas d'Output Directory : fonctions uniquement).
- La fonction `server/api/index.mjs` expose tout Express (`/api/*` via
  `server/vercel.json`) en important le **JS compilé** (`server/dist`).
- **Env (obligatoires)** :
  `MONGODB_URI` (avec nom de base), `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `CLIENT_URL=https://focus-web-xxx.vercel.app`,
  `STORAGE_PROVIDER=gridfs`, `STORAGE_DIR=/tmp`,
  `MAX_FILE_SIZE_MB=10`, `MAX_WORKSPACE_STORAGE_MB=1024`,
  `NODE_ENV=production`.

## Ordre

1. `git add -A && git commit -m "..." && git push` (tout doit être poussé,
   y compris `server/api/`, sinon la fonction n'existe pas).
2. Créer + déployer `focus-api`, récupérer son URL, vérifier `/health`.
3. Renseigner `VITE_API_URL` sur `focus-web`, déployer, tester :
   inscription → upload → rechargement.

## Limites honnêtes (serverless hobby ~10 s)

- Inscription (bcrypt) et gros uploads peuvent frôler le timeout à froid :
  `MAX_FILE_SIZE_MB=10`, ou plan Pro / backend dédié (Render + disque).
- `connectDb()` est mise en cache entre invocations chaudes (M0 : 500
  connexions max — surveiller sur Atlas).
- Cookies `Secure + SameSite=None` : HTTPS des deux côtés, `CLIENT_URL`
  exacte sinon CORS rejette les appels authentifiés.
