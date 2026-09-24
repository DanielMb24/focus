# DÉPLOIEMENT — Fullstack Vercel (frontend + API serverless)

Le projet est configuré pour tourner **entier sur Vercel** :
frontend statique (`client/dist`) + API Express en fonction serverless
(`api/index.mjs`, qui importe le **JS compilé** `server/dist` — jamais les
`.ts` sources, pour une résolution de fichiers sans ambiguïté).
La racine du projet Vercel reste le **dossier racine**
(le `vercel.json` racine fait déjà : build des workspaces, `/api/*` vers
la fonction, fallback SPA vers `/index.html`).

## 1. Variables d'environnement Vercel (obligatoires)

| Variable | Valeur |
|---|---|
| `MONGODB_URI` | URI Atlas **avec nom de base** (ex. `.../taskmg-1?...`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | secrets longs et distincts |
| `CLIENT_URL` | URL exacte de l'app (ex. `https://focus-xxx.vercel.app`) |
| `STORAGE_PROVIDER` | `gridfs` (binaires dans MongoDB = persiste en serverless) |
| `STORAGE_DIR` | `/tmp` (requis : seul `/tmp` est inscriptible en serverless) |
| `MAX_FILE_SIZE_MB` | `10` conseillé (timeout hobby : gros uploads = 500) |
| `MAX_WORKSPACE_STORAGE_MB` | `1024` |
| `NODE_ENV` | `production` |

> Sans `STORAGE_PROVIDER=gridfs`, les uploads iraient sur le disque
> éphémère et **disparaîtraient** entre deux requêtes. Le provider local
> reste le défaut en développement (`STORAGE_PROVIDER=local`).

## 2. Redéployer

```bash
git add -A && git commit -m "..." && git push
```
Vercel rebuild : `npm run build --workspaces` (frontend + `tsc` backend).
Vérifier `/health` puis inscription → upload → rechargement.

## 3. Limites serverless connues (honnêtes)

- **Timeout hobby (~10 s)** : inscription (bcrypt) et gros uploads peuvent
  flirter avec la limite à froid. Si 500 fréquents : réduisez
  `MAX_FILE_SIZE_MB`, ou passez au plan Pro / backend dédié (Render).
- **Connexions Mongo** : `connectDb()` est mise en cache et réutilisée
  entre invocations chaudes ; à froid, une connexion s'ouvre par instance.
  Surveillez le nombre de connexions Atlas (M0 : 500 max).
- **Cookies** : `Secure + SameSite=None` exigent du HTTPS des deux côtés —
  OK sur `*.vercel.app`.
- **CORS** : `CLIENT_URL` doit contenir l'URL exacte, sinon les appels
  avec `credentials: include` sont rejetés.

## 4. Alternative backend dédié (si le serverless coince)

`docs/PACKAGING.md` + Render/Railway/VPS avec disque persistant
(`STORAGE_PROVIDER=local`, `STORAGE_DIR=/app/uploads`). Dans ce cas,
`VITE_API_URL` côté frontend pointe vers l'URL du backend dédié.
