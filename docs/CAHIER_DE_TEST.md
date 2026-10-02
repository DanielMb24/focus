# Cahier de test — Focus (plateforme de productivité)

Ce document décrit l'ensemble des cas de test de l'application Focus : tâches, projets, fichiers, calendrier, objectifs, notes, focus, messagerie, espaces et paramètres. Il permet de parcourir toutes les fonctionnalités et de consigner le verdict de chaque test.

Version **1.0 – 02/10/2026** · Périmètre : web (`/`) + PWA · Profils : visiteur non connecté, utilisateur connecté (étudiant / professionnel / entrepreneur — l'onboarding seul diffère).

## 0. Règles du jeu

- **Verdicts** : OK (conforme), KO (anomalie — créer un ticket avec ID du cas + capture), BLOQUÉ (prérequis impossible), N/A (non applicable à l'environnement).
- **Environnements** : `E1` local (`http://localhost:5173` + API `:4000`), `E2` production (URL Vercel à compléter).
- **Comptes de test** (à créer en E1/E2) : `testeur1@exemple.com` / ` Motdepasse1!`, `testeur2@exemple.com` / `Motdepasse1!` (requis pour la messagerie et les invitations). Vérifier les emails si la vérification est active.
- **Colonnes** : ID (stable pour les tickets), Fonctionnalité, Description (pas à pas), Résultat attendu, Résultat du test (à remplir : OK / KO / BLOQUÉ + date + initiales).
- Les cas marqués **[NR]** sont des non-régressions issues de bugs déjà corrigés : ils doivent rester verts.

## Module 1 — Accès & Auth

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| AUTH-01 | Inscription nominale | 1. Ouvrir `/register`. 2. Saisir prénom, email valide, mot de passe 8+ caractères, profil. 3. Valider. | Compte créé, redirection vérification email ou onboarding, session ouverte. |  |
| AUTH-02 | Inscription invalide | 1. Laisser un champ vide, puis tester email invalide et mot de passe < 8 caractères. 2. Valider. | Création bloquée, message d'erreur clair à chaque fois. |  |
| AUTH-03 | Email déjà utilisé | 1. S'inscrire deux fois avec le même email. | 2e tentative refusée avec message explicite (pas d'erreur 500). |  |
| AUTH-04 | Vérification email | 1. Saisir un code erroné. 2. Cliquer renvoyer. 3. Saisir le bon code. | Code erroné refusé ; renvoi fonctionnel ; bon code débloque l'accès. |  |
| AUTH-05 | Onboarding | 1. Renseigner prénom, profil, nom d'espace. 2. Valider. | Espace créé et actif, arrivée sur le dashboard avec suggestions du profil. |  |
| AUTH-06 | Connexion nominale | 1. Ouvrir `/login`. 2. Saisir identifiants valides. 3. Valider. | Redirection dashboard (ou onboarding si incomplet). |  |
| AUTH-07 | Connexion invalide | 1. Saisir email inconnu puis mot de passe erroné. | Message « identifiants invalides », pas de session ouverte. |  |
| AUTH-08 | Mot de passe oublié | 1. `/forgot-password` : demander un lien. 2. Définir un nouveau mot de passe (8+). 3. Se connecter avec. | Lien fonctionnel, nouveau mot de passe accepté, ancien refusé. |  |
| AUTH-09 | Session persistante | 1. Se connecter. 2. Attendre l'expiration de l'access token (15 min) ou le supprimer du stockage. 3. Naviguer. | Session renouvelée en silence (UN seul `POST /refresh` en réseau), pas de déconnexion. **[NR]** |  |
| AUTH-10 | Déconnexion | 1. Menu profil → Se déconnecter. 2. Tenter `/` en collant l'URL. | Retour `/login`, routes protégées inaccessibles. |  |
| AUTH-11 | Route protégée sans session | 1. En navigation privée, ouvrir `/tasks`, `/notes/xxx`, `/chat`. | Redirection `/login` à chaque fois. |  |

## Module 2 — Dashboard

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| DASH-01 | Chiffres du jour | 1. Créer des tâches aujourd'hui / terminées / en retard. 2. Ouvrir `/`. | Les 4 compteurs (Aujourd'hui, Terminées, En retard, Progression %) sont exacts. |  |
| DASH-02 | Suggestions par profil | 1. Nouveau compte (< 5 tâches). 2. Cliquer une suggestion. | Suggestions du profil, tâche créée en 1 clic. |  |
| DASH-03 | Liens Tout voir | 1. Cliquer chaque « Tout voir ». | Navigation vers `/today`, `/projects`, `/files`. |  |
| DASH-04 | Rail droit (écran large) | 1. Afficher en ≥ 1280px avec tâches à venir + sessions focus + objectifs. | Colonne Semaine / Focus / Objectifs visible et exacte ; invisible sous ce seuil. |  |
| DASH-05 | États vides | 1. Nouveau compte sans données. | États vides + CTA (Créer une tâche / un projet), rien de cassé. |  |

## Module 3 — Tâches

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| TASK-01 | Création complète | 1. Bouton + → renseigner titre, projet, échéance, priorité, objectif, description, tags. 2. Créer. | Tâche visible dans Mes tâches avec tous les champs. |  |
| TASK-02 | Titre requis | 1. Tenter de créer sans titre. | Création bloquée, message « Titre requis ». |  |
| TASK-03 | Modification | 1. Ouvrir Modifier. 2. Changer titre, statut, priorité, échéance, durée. 3. Enregistrer. | Modifications persistées après rechargement. |  |
| TASK-04 | Terminer / Rouvrir | 1. Cocher la case puis rouvrir (bouton ou case). | Statut + date de complétion cohérents, barrée visuellement. |  |
| TASK-05 | Suppression | 1. Supprimer (confirmer si demandé). | Tâche absente des listes après rechargement. |  |
| TASK-06 | Reporter à demain | 1. Bouton Reporter sur une tâche non terminée. | Échéance = demain, tâche visible dans Aujourd'hui. |  |
| TASK-07 | Sous-tâches | 1. Ajouter 2 sous-tâches, en cocher 1, en retirer 1. | Compteur x/y exact, persistance après rechargement. |  |
| TASK-08 | Priorité segmentée | 1. Créer avec chaque priorité (Basse → Urgente). | Bonne valeur enregistrée et badge correct. |  |
| TASK-09 | Onglets de statut | 1. Parcourir Toutes / À faire / En cours / Terminées / En retard. | Chaque onglet ne montre que le bon statut. |  |
| TASK-10 | Recherche & filtres | 1. Rechercher un mot, filtrer projet / priorité / tag. | Résultats filtrés (< 500 ms de debounce ressenti), cumul des filtres. |  |
| TASK-11 | Page Aujourd'hui | 1. Avec tâches en retard, du jour et terminées. 2. Tester la capture rapide. | 3 sections exactes ; la capture crée une tâche du jour. |  |
| TASK-12 | Détail tâche | 1. Ouvrir `/tasks/:id` : actions, description, sous-tâches, pièces jointes, notes liées, bloc Détails. | Tout s'affiche et agit (Terminer, Demain, Modifier, Supprimer). |  |
| TASK-13 | Notes liées | 1. Lier une note existante. 2. Créer une note liée. 3. Détacher. | Liste à jour, ouverture éditeur OK, détachement sans suppression de la note. |  |

## Module 4 — Projets & Kanban

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| PROJ-01 | Création projet | 1. Nouveau projet (+ option dossier auto). | Projet listé, dossier créé si coché. |  |
| PROJ-02 | Liste & progression | 1. Avec tâches terminées / en cours. | Barre % et compteurs x/y exacts. |  |
| PROJ-03 | Onglets détail | 1. Parcourir Aperçu / Liste / Board / Fichiers. | Chaque vue affiche les bonnes données. |  |
| PROJ-04 | Kanban drag & drop | 1. Glisser une carte entre colonnes (souris + tactile). | Statut mis à jour et persisté. |  |
| PROJ-05 | Modifier / supprimer | 1. Renommer puis supprimer (confirmer). | Modifications persistées ; suppression retire le projet. |  |
| PROJ-06 | Sans espace actif | 1. Retirer l'espace actif si possible, tenter de créer. | Message clair, pas d'erreur 500. |  |

## Module 5 — Fichiers

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| FILE-01 | Dossiers | 1. Créer dossier + sous-dossier, renommer, naviguer (fil d'Ariane / retour). | Arborescence cohérente après rechargement. |  |
| FILE-02 | Upload | 1. Importer plusieurs fichiers (PDF, image, texte). | Fichiers listés avec taille/type, sans duplication. |  |
| FILE-03 | Type refusé | 1. Importer un `.exe` ou contenu incohérent. | Refusé avec message explicite. |  |
| FILE-04 | Aperçu & téléchargement | 1. Aperçu image/PDF/texte. 2. Télécharger. | Aperçu lisible, fichier intègre à l'ouverture. |  |
| FILE-05 | Sécurité accès | 1. Copier l'URL de téléchargement en navigation privée (sans session). | `401 UNAUTHORIZED`, aucun octet servi. |  |
| FILE-06 | Favoris / récents / recherche / tri / vues | 1. Marquer favori, chercher un nom, trier, basculer grille/liste. | Chaque vue/filtre exact. |  |
| FILE-07 | Corbeille | 1. Mettre à la corbeille, restaurer, puis supprimer définitivement. | États successifs exacts. |  |
| FILE-08 | Liaisons | 1. Lier un fichier à tâche / projet / note / objectif, puis détacher. | Visible dans « Fichiers liés » de l'entité, sans duplication. |  |
| FILE-09 | Quota | 1. Consulter le quota. 2. Tenter de dépasser (si possible). | Jauge exacte, dépassement bloqué proprement. |  |

## Module 6 — Calendrier

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| CAL-01 | Navigation mois | 1. Mois précédent/suivant + bouton Aujourd'hui. | Mois et libellé exacts, retour au jour courant. |  |
| CAL-02 | Alignement semaine | 1. Afficher un mois dont le 1er n'est pas un lundi (ex. janvier 2027). | Le 1er est sous son vrai jour, libellé du jour sélectionné cohérent. **[NR]** |  |
| CAL-03 | Pastilles & sélection | 1. Avec tâches + retard. 2. Cliquer un jour à pastille. | Pastilles tâches/retard exactes, liste du jour correcte. |  |
| CAL-04 | Capture du jour | 1. Ajouter « + Tâche le … » sur le jour sélectionné. | Tâche créée à cette date, pastille apparue. |  |

## Module 7 — Objectifs

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| GOAL-01 | CRUD objectif | 1. Créer (titre, description, date cible), modifier, archiver/supprimer. | Liste à jour après rechargement. |  |
| GOAL-02 | Progression auto | 1. Lier des tâches, en terminer une partie. | % = terminées / total (hors annulées). |  |
| GOAL-03 | Champs & statuts | 1. Tester date cible vide, statuts actif/terminé/archivé. | Affichage et filtres cohérents. |  |

## Module 8 — Notes & exports

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| NOTE-01 | Capture & liste | 1. Capture rapide + « Nouveau document ». 2. Rechercher. | Notes listées avec aperçu, date, mots ; recherche filtre. |  |
| NOTE-02 | Éditeur riche | 1. Titres, puces, numérotées, cases, citation, code, lien, alignements, tableau 3×3 (+ ligne/colonne). | Rendu fidèle, persistance après rechargement. |  |
| NOTE-03 | Sauvegarde auto | 1. Frapper puis attendre. 2. Couper le réseau et frapper. | Statut « Enregistré à … » ; hors-ligne : état « Non enregistré » + bouton Réessayer. |  |
| NOTE-04 | Assistant — résumé & titre | 1. Rédiger 6+ phrases. 2. Copier le résumé, appliquer le titre proposé. | Résumé pertinent, titre appliqué au document. |  |
| NOTE-05 | Assistant — actions | 1. Écrire TODO / cases décochées / lignes datées. 2. « Créer N tâches ». | Tâches créées dans Mes tâches (échéances devinées si date). |  |
| NOTE-06 | Assistant — plan / liées / stats | 1. Avec titres + 2e note au vocabulaire proche. | Outline exact, note liée proposée, stats mots/min/phrases. |  |
| NOTE-07 | Export Word | 1. Exporter `.docx` (titres, listes, cases, tableau). | Fichier ouvrable dans Word/LibreOffice, mise en forme conservée. |  |
| NOTE-08 | Export PDF / Markdown / HTML | 1. PDF via impression, `.md`, copier HTML. | PDF fidèle, MD structuré, HTML collable. |  |
| NOTE-09 | Dupliquer / supprimer | 1. Dupliquer (ouvre la copie), supprimer (confirmer). | Copie « (copie) » indépendante ; suppression effective. |  |
| NOTE-10 | Anciens contenus | 1. Ouvrir une note créée avant l'éditeur riche (texte brut). | Texte repris en paragraphes, éditable et exportable. |  |

## Module 9 — Focus

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| FOC-01 | Session preset | 1. Choisir 25/50 min + tâche, Démarrer. | Minuteur décompte, tâche affichée. |  |
| FOC-02 | Durée perso & fin | 1. Saisir durée perso. 2. Aller au bout, puis tester Pause/Terminer. | Notification de fin, session enregistrée (Terminée si ≥ 90 %). |  |
| FOC-03 | Stats & historique | 1. Consulter minutes du jour + sessions récentes. | Totaux exacts. |  |

## Module 10 — Messagerie

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| CHAT-01 | Page vide | 1. Ouvrir `/chat` sans discussion. | État vide + CTA « Nouvelle discussion ». |  |
| CHAT-02 | Direct 1-1 | 1. Créer avec testeur2. 2. Recréer la même. | Discussion ouverte ; 2e création réutilise l'existante. |  |
| CHAT-03 | Groupe | 1. Créer avec 2+ membres + nom. | Groupe nommé, membres visibles. |  |
| CHAT-04 | Envoi / réception | 1. testeur1 envoie, testeur2 lit (et inversement). | Messages des deux côtés sous ~5 s, ordre et heures exacts. |  |
| CHAT-05 | Non-lus | 1. Recevoir sans lire. 2. Ouvrir la discussion. | Pastilles (liste, sidebar, mobile) puis remise à zéro. |  |
| CHAT-06 | Historique | 1. 50+ messages, « Charger l'historique ». | Anciens prépendus sans doublon, scroll conservé. |  |
| CHAT-07 | Invitation | 1. Inviter email existant / inconnu / déjà membre (non-responsable si possible). | Ajout + messages clairs pour chaque cas d'erreur. |  |
| CHAT-08 | Seul dans l'espace | 1. Ouvrir la modale sans autre membre. | Message explicite + bloc d'invitation (pas de « Aucun membre » sec). |  |
| CHAT-09 | Validation message | 1. Envoyer vide / > 2000 caractères. | Refusés proprement. |  |
| CHAT-10 | Mobile | 1. Liste OU fil + retour, envoi. | Navigation et envoi OK au format téléphone. |  |

## Module 11 — Espaces & Paramètres

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| WS-01 | Espaces | 1. Créer, renommer si possible, basculer d'espace. | Données filtrées par espace actif. |  |
| SET-01 | Profil | 1. Modifier prénom/nom/préférences. | Persisté et répercuté (ex. « Bonjour … »). |  |
| SET-02 | Mot de passe | 1. Changer (actuel erroné puis correct, confirmation différente). | Erreurs claires puis succès ; reconnexion avec le nouveau. |  |
| SET-03 | Notifications | 1. Activer système, déclencher une échéance/fin focus. | Centre + notification système. |  |
| SET-04 | Installations | 1. Prompt PWA + liens APK/EXE si configurés. | Installable / liens valides. |  |

## Module 12 — Transverse

| ID | Fonctionnalité | Description | Résultat attendu | Résultat du test |
| --- | --- | --- | --- | --- |
| TRV-01 | Mobile | 1. Parcourir en 360px : bottom-nav 6 onglets, éventail +, safe-area. | Aucun débordement, actions atteignables. |  |
| TRV-02 | Hors-ligne | 1. Couper le réseau : naviguer, créer une note, importer un fichier. | Bandeau + file d'attente + resync à la reconnexion. |  |
| TRV-03 | Thème sombre | 1. Activer sur Dashboard, Tâches, Notes, Chat. | Lisible partout, aucun texte invisible. |  |
| TRV-04 | Recherche globale | 1. `Ctrl+K`, chercher tâche/projet/fichier/note. | Résultats exacts et navigation OK. |  |
| TRV-05 | Non-régression React | 1. Naviguer sur toutes les pages en dev. | Aucun « Unexpected Application Error » / écran blanc. **[NR]** |  |

## Annexe — Fiche de campagne

À dupliquer par campagne : date, environnement (E1/E2), version, testeur, totaux OK / KO / BLOQUÉ, liens des tickets KO (ID du cas + capture + console).
