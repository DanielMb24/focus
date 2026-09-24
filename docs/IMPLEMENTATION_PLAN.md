# IMPLEMENTATION PLAN — SaaS Productivité PWA (Étudiants / Pros / Entrepreneurs)

## 1. Vision & décisions structurantes

- **Monorepo npm workspaces** : `client/` (Vite+React+TS) + `server/` (Express+TS) + `docs/`. Pas de Next.js, pas de microservices : monolithe modulaire.
- **Logique produit** : `User → Workspace(s) → Project(s) → Task(s)`, tâche possible sans projet (`projectId?`). Objectifs/Notes/Focus liés à workspace et/ou projet.
- **Profil unique** (`student|professional|entrepreneur`) : même moteur, seuls onboarding copy, suggestions et seeds/templates changent. Stocké sur `users.profileType`.
- **Auth JWT** : Access court (15m) + Refresh long (30j) en cookie HttpOnly + collection `refreshTokens` avec rotation + réutilisation détectée. `bcryptjs` (pur JS, pas de build). Middleware `requireAuth`. Préparé pour OAuth (champ `authProvider`, `providerId` sur User) sans l'implémenter.
- **Format API unique** `{success,data|error,meta}` + versionnement `/api/v1`.
- **Frontend state** : TanStack Query = serveur ; Zustand = UI globale uniquement (workspace actif, sidebar, quick-add, thème). Pas de fetch dispersé : `lib/api.ts` + `services/*` + hooks `features/*`.
- **UI** : Tailwind, palette sobre (fond zinc-50/blanc, texte zinc-900/500, accent indigo-600 unique), Inter, sidebar desktop collapsible + bottom-nav mobile avec bouton `+` central, dark-mode via variables CSS (`class="dark"`, non activé par défaut mais compatible).
- **PWA** : `vite-plugin-pwa` (Workbox generateSW, cache API NetworkFirst, assets CacheFirst, page offline `/offline.html`, update prompt + détection online/offline).
- **Qualité** : TS strict, `no-explicit-any` warn, Zod partagé côté client + validation backend (zod aussi côté serveur pour une seule source de vérité), Helmet/CORS/rate-limit, ESLint+Prettier.

## 2. Modèles MongoDB (Mongoose)

```
users: firstName, lastName?, email(unique,lowercase), passwordHash?, authProvider(enum:local,google,apple,microsoft), providerId?, profileType(enum), onboardingCompleted(bool), avatar?, preferences{language,timezone,theme}, timestamps. Jamais de passwordHash en réponse (toJSON transform).
workspaces: name, slug(unique par owner + suffixe), ownerId(ref User), type(enum personal|school|work|business), timestamps
workspaceMembers: workspaceId, userId, role(enum owner|admin|member), timestamps. Unique (workspaceId,userId).
projects: workspaceId, name, description?, status(active|completed|archived), startDate?, dueDate?, color?, icon?, createdBy, timestamps. Index (workspaceId,status), (createdBy).
tasks: workspaceId, projectId?, goalId?, createdBy, title, description?, status(todo|in_progress|completed|cancelled), priority(low|medium|high|urgent), startDate?, dueDate?, tags[], subtasks[{title,completed}], estimatedDuration?, completedAt?, position(number pour Kanban), timestamps. Index (createdBy,workspaceId), (status), (dueDate), (projectId), text(title,description).
goals: workspaceId, createdBy, title, description?, targetDate?, progress(0-100 calculable), status(active|completed|archived), taskIds? (ou liaison inverse tasks.goalId — on retient tasks.goalId + virtual count), timestamps.
notes: workspaceId, projectId?, createdBy, title, content?, timestamps. Index (workspaceId,createdBy).
focusSessions: userId, workspaceId?, taskId?, startedAt, endedAt?, durationSec, plannedSec, completed(bool), timestamps. Index (userId,startedAt).
refreshTokens: userId, tokenHash, expiresAt, revokedAt?, replacedBy?, userAgent?, ip?, timestamps. Index (userId), TTL sur expiresAt.
```

Progression projet = `completedTasks / totalNonCancelled` calculée à la volée (aggregation) — pas de champ dénormalisé en MVP (évite désync), avec endpoint `GET /projects/:id/stats`.

## 3. Routes API `/api/v1`

```
auth: POST register|login|refresh|logout, GET me, PATCH me (profil+préférences), POST onboarding (complete: firstName,profileType,workspaceName,preferences)
workspaces: GET / POST / GET :id / PATCH :id / DELETE :id (+ GET :id/stats)
projects: GET ?workspaceId&status&search&page&limit / POST / GET :id / PATCH :id / DELETE :id / GET :id/stats
tasks: GET ?workspaceId&projectId&status&priority&dueFrom&dueTo&search&tags&goalId&page&limit&sort / POST / GET :id / PATCH :id / DELETE :id / PATCH :id/complete / PATCH :id/move (status+position pour Kanban)
goals: CRUD + PATCH :id/progress (recalc auto depuis tâches liées)
notes: CRUD ?workspaceId&projectId&search
focus: POST /start {taskId?,plannedSec} / POST /:id/stop / GET ?from&to / GET /stats (total du jour/semaine)
```

Erreurs normalisées : `VALIDATION_ERROR(400) UNAUTHORIZED(401) FORBIDDEN(403) NOT_FOUND(404) CONFLICT(409) RATE_LIMITED(429) INTERNAL(500)`.

## 4. Structure

```
server/src: config/env.ts|db.ts, middleware/auth.ts|errorHandler.ts|validate.ts|rateLimit.ts|ownership.ts,
 modules/{auth,users,workspaces,projects,tasks,goals,notes,focus}/*.controller|service|routes|validation.ts,
 shared/errors|utils|types, app.ts, server.ts
client/src: app/{App.tsx,providers.tsx}, routes/{guards.tsx,router.tsx}, lib/{api.ts,queryClient.ts,dates.ts}, store/{ui.ts,workspace.ts},
 services/*.ts, features/{auth,onboarding,dashboard,tasks,projects,calendar,goals,notes,focus,workspaces}/..., components/{ui/*,layout/*,common/*}, pages/*.tsx, types/index.ts, utils/*, pwa/*
```

## 5. Pages & composants clés

Routes : `/login /register /onboarding / /today /tasks /projects /projects/:id (tabs Overview|List|Board) /calendar /goals /notes /focus /settings /offline.html`.
Composants : `Sidebar, MobileNav(+QuickAdd), Topbar, TaskCard, TaskQuickAdd(modal desktop/bottom-sheet mobile), TaskDetail(drawer), ProjectCard, KanbanBoard(dnd-kit), MonthCalendar, FocusTimer, StatsRow, EmptyState, Skeleton, ErrorState, OfflineBanner, UpdatePrompt`.
Dashboard : header `Bonjour {firstName} + date fr`, 4 stats (aujourd'hui/terminées/en retard/progression), liste Aujourd'hui triée (urgent>high>heure), projets récents + barres, priorités.

## 6. Ordre d'implémentation (cf. §56 CDC)

1. Root + tooling (workspaces, TS, ESLint, Prettier) 2. Server base+Mongo 3. Auth complète 4. Workspaces+members 5. Tasks 6. Projects 7. Client base+layout+PWA shell 8. Auth+Onboarding front 9. Dashboard+Today 10. Tasks+Projects+Kanban 11. Calendar+Goals+Notes+Focus 12. Offline/Update/Responsive polish 13. Seed+tests ciblés+README+Docker.

## 7. Dépendances

Server: express, mongoose, bcryptjs, jsonwebtoken, cookie-parser, helmet, cors, express-rate-limit, zod, dotenv, morgan(dev).
Client: react-router-dom, @tanstack/react-query, zustand, react-hook-form, @hookform/resolvers, zod, lucide-react, date-fns, @dnd-kit/core|sortable|utilities, vite-plugin-pwa (+ workbox-window). Dev: vite, tailwindcss v3 + postcss + autoprefixer (v3 stable, pas v4 pour éviter breaking), typescript, eslint, prettier.

## 9. Module Documents / Fichiers (§63-132)

- Collections : `folders` (parentId, pas d'imbrication), `files` (FileAsset : métadonnées + storageKey opaque `workspace/aaaa/mm/uuid.ext`, jamais de Base64), `fileLinks` (liaison sans duplication), `uploadSessions`.
- Stockage : interface `StorageProvider` (`store/readStream/stat/delete/exists`) ; `LocalStorageProvider` (dev, servi uniquement via routes authentifiées + Range 206) ; S3/R2/MinIO branchable dans `storage/index.ts` (URLs signées prévues).
- Upload : multer (tmp disque, max 10 fichiers, `MAX_FILE_SIZE_MB`), allowlist extension+MIME, vérification magique `file-type`, quota espace (`MAX_WORKSPACE_STORAGE_MB`), checksum/dimensions/durée calculés côté client.
- Offline : file IDB `pending-uploads` (rejeu auto à la reconnexion) + `offline-files` (marquage « disponible hors connexion ») ; jamais de blobs dans Zustand/localStorage.
- PWA : `share_target` GET (texte/liens → note via `/share-target`), `navigator.share` + `canShare` avec fallback, `showDirectoryPicker` avec fallback `webkitdirectory`, `capture="environment"` pour photo/scan.
- Scanner : capture multi-pages, réorganisation, génération PDF (jsPDF) importée comme un fichier normal.

## 8. Risques & arbitrages

- Tailwind v4 vs v3 : on fige **v3.4** (config `tailwind.config.js` classique, compatible PWA template).
- dnd-kit mobile : utiliser `TouchSensor` + `PointerSensor` avec délai d'activation, colonnes scrollables.
- Timezone : stockage UTC, affichage `date-fns` + `preferences.timezone` (MVP : locale fr).
- Pas d'OKR/CRM/fichiers : champs d'extension prévus (`goalId`, `workspaceMembers`) sans UI.
