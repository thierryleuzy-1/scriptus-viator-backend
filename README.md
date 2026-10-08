# Scriptus Viator — mise en ligne (guide pas à pas)

Ce guide est écrit pour quelqu'un qui n'a **aucune** expérience technique. Chaque étape est détaillée — ne saute aucune étape, même si elle te semble évidente. Compte environ 30 à 45 minutes la première fois.

Tu vas créer, dans l'ordre :
1. Un compte **Supabase** (la base de données — gratuite pour commencer).
2. Une clé **Anthropic** (ce qui fait fonctionner les générations par l'IA — payante à l'usage, quelques sous par génération).
3. Un déploiement **Vercel** (ce qui rend l'app accessible sur Internet — gratuit pour cet usage).
4. Ton premier lien personnel, depuis la page d'administration de l'app.

---

## Étape 1 — Créer la base de données (Supabase)

1. Va sur **[supabase.com](https://supabase.com)** et clique sur **Start your project** (ou **Sign in**). Crée un compte (avec GitHub ou un courriel) si tu n'en as pas.
2. Une fois connecté, clique sur **New project**.
3. Donne-lui un nom (par exemple `scriptus-viator`), choisis un mot de passe pour la base de données (note-le quelque part — tu n'en auras pas besoin tout de suite, mais garde-le), et choisis une région proche de toi (par exemple `Canada (Central)` ou `East US`).
4. Clique sur **Create new project**. Patiente une à deux minutes pendant que Supabase prépare tout.
5. Une fois le projet prêt, dans le menu de gauche, clique sur l'icône **SQL Editor** (une icône qui ressemble à `</>`).
6. Clique sur **New query**.
7. Ouvre, sur ton ordinateur, le fichier `sql/schema.sql` qui se trouve dans le dossier de ce projet (le même dossier que ce README). Ouvre-le avec un simple éditeur de texte (Bloc-notes, TextEdit, ou autre) — **sélectionne tout son contenu et copie-le** (Ctrl+A puis Ctrl+C, ou Cmd+A puis Cmd+C sur Mac).
8. Reviens dans Supabase, colle ce contenu dans la grande zone blanche du **SQL Editor**, puis clique sur le bouton **Run** (en bas à droite, ou Ctrl+Entrée).
9. Tu dois voir un message de succès (« Success. No rows returned »). Si tu vois une erreur, relis l'étape 7 : assure-toi d'avoir copié *tout* le fichier, sans rien couper.

Tu as maintenant quatre tables prêtes : `persons`, `projects`, `praxeologie_entries`, `coaching_notes`.

### Récupérer les clés Supabase (pour plus tard, étape 4)

1. Toujours dans Supabase, clique sur l'icône **Project Settings** (une roue dentée, en bas du menu de gauche).
2. Clique sur **API** dans le sous-menu.
3. Tu vois deux informations à garder de côté (ouvre un fichier texte temporaire sur ton ordinateur et colles-y les deux) :
   - **Project URL** — une adresse qui ressemble à `https://xxxxxxxxxxxx.supabase.co`. Ce sera la variable `SUPABASE_URL`.
   - **service_role** (sous « Project API keys », clique sur **Reveal** pour l'afficher) — une longue chaîne de caractères. Ce sera la variable `SUPABASE_SERVICE_KEY`.

   ⚠️ **La clé `service_role` donne un accès complet à la base de données.** Ne la partage avec personne, ne la mets jamais dans une page web, un courriel ou un message — seulement dans les variables d'environnement Vercel (étape 4).

---

## Étape 2 — Obtenir une clé Anthropic (pour les générations par l'IA)

1. Va sur **[console.anthropic.com](https://console.anthropic.com)** et crée un compte, ou connecte-toi.
2. Cette API est **payante à l'usage** (pas d'abonnement fixe) : il faut ajouter un moyen de paiement. Dans le menu de gauche, cherche **Billing** (ou **Plans & Billing**) et ajoute une carte, avec un petit crédit de départ (quelques dollars suffisent pour commencer — chaque génération coûte une fraction de cent à quelques cents).
3. Dans le menu de gauche, clique sur **API Keys**.
4. Clique sur **Create Key**, donne-lui un nom (par exemple `scriptus-viator`), puis copie la clé générée (elle commence par `sk-ant-`) — **tu ne pourras plus la revoir ensuite**, alors garde-la dans ton fichier texte temporaire, à côté des clés Supabase. Ce sera la variable `ANTHROPIC_API_KEY`.

---

## Étape 3 — Choisir une clé d'administration

Tu dois inventer toi-même un mot de passe pour la page d'administration (`/admin.html`) — ce n'est pas un compte, juste une phrase secrète que **toi seul** connais. Choisis quelque chose de long et pas évident (par exemple une phrase de 5-6 mots). Note-la dans ton fichier texte temporaire. Ce sera la variable `ADMIN_KEY`.

---

## Étape 4 — Déployer sur Vercel

### Créer le compte et importer le projet

1. Va sur **[vercel.com](https://vercel.com)** et crée un compte (le plus simple : avec GitHub).
2. **Si tu as GitHub** : mets d'abord ce dossier de projet dans un dépôt GitHub (si tu ne sais pas comment faire, demande à la personne qui t'a remis ce projet de le faire pour toi, ou utilise l'option CLI ci-dessous, qui ne demande pas GitHub). Puis, dans Vercel, clique sur **Add New… → Project**, choisis **Import Git Repository**, et sélectionne ce dépôt.
3. **Si tu n'as pas GitHub** (option sans GitHub, via une ligne de commande — demande de l'aide si cette partie t'intimide) :
   - Installe [Node.js](https://nodejs.org) si ce n'est pas déjà fait (bouton « LTS » sur leur page d'accueil).
   - Ouvre le Terminal (Mac/Linux) ou l'invite de commandes PowerShell (Windows).
   - Tape `npm install -g vercel` puis Entrée.
   - Déplace-toi dans le dossier de ce projet (par exemple `cd Downloads/scriptus-viator-backend-v2`).
   - Tape `vercel` puis Entrée, et suis les instructions à l'écran (connexion, puis « Set up and deploy? » → oui, garder les réglages par défaut proposés).

### Ajouter les variables d'environnement

Avant — ou juste après — le premier déploiement, Vercel te permet d'ajouter des **variables d'environnement**. Si tu es passé par le site web :

1. Dans le tableau de bord du projet sur Vercel, va dans **Settings → Environment Variables**.
2. Ajoute, une par une (nom exact à gauche, valeur à droite, puis **Save**) :

   | Nom de la variable | Valeur |
   |---|---|
   | `SUPABASE_URL` | le **Project URL** noté à l'étape 1 |
   | `SUPABASE_SERVICE_KEY` | la clé **service_role** notée à l'étape 1 |
   | `ANTHROPIC_API_KEY` | la clé notée à l'étape 2 (commence par `sk-ant-`) |
   | `ADMIN_KEY` | la phrase secrète choisie à l'étape 3 |

3. Une fois les quatre variables ajoutées, va dans l'onglet **Deployments**, clique sur les trois petits points `⋯` du déploiement le plus récent, puis **Redeploy** — pour que les variables soient bien prises en compte.

Si tu es passé par la ligne de commande (`vercel`), tu peux ajouter les variables avec, pour chacune :
```
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add ADMIN_KEY
```
(il te demandera de coller la valeur, puis de choisir l'environnement — choisis **Production**). Ensuite, tape `vercel --prod` pour redéployer avec ces variables.

### Vérifier que ça fonctionne

Une fois déployé, Vercel t'indique une adresse (quelque chose comme `https://scriptus-viator-backend-v2.vercel.app`). Ouvre-la dans ton navigateur : tu devrais voir un message disant qu'un lien personnel est requis — c'est normal et attendu, personne n'a encore de lien.

---

## Étape 5 — Créer le premier lien personnel

1. Dans ton navigateur, ajoute `/admin.html` à la fin de l'adresse de ton site (par exemple `https://scriptus-viator-backend-v2.vercel.app/admin.html`).
2. Colle la **clé d'administration** choisie à l'étape 3, clique sur **Entrer**.
3. Dans **Ajouter une personne**, tape le nom de la personne (par exemple ton propre nom, pour tester), puis clique sur **Créer le lien**.
4. Le lien complet apparaît — clique sur **Copier**, puis transmets-le à cette personne (ou ouvre-le toi-même dans un nouvel onglet pour essayer l'app).
5. La page liste ensuite toutes les personnes créées, avec l'étape où en est leur projet, leur nombre de sessions, et leur dernière activité — reviens ici à tout moment pour suivre leur évolution ou créer de nouveaux liens.

**Garde la clé d'administration pour toi** — c'est elle qui protège cette page. Si tu la perds, change simplement la variable `ADMIN_KEY` dans Vercel (Settings → Environment Variables → modifie sa valeur → Redeploy) pour en choisir une nouvelle.

---

## Les notes de coaching — lire et accompagner chaque personne

Depuis la liste des personnes (`/admin.html`), un lien **👁 Voir le détail** apparaît maintenant sur chaque ligne. Il ouvre une page qui te montre **tout ce que cette personne a écrit** : chaque session d'écriture de chaque étape (le manuscrit déposé, le témoignage, les deux analyses — poïétique et praxéologique — avec, pour chacune, la réponse que la personne y a donnée), ses auto-évaluations de l'expérience d'écriture, la synthèse de chaque étape, et, pour « Ce qu'il en naît », le texte intégral, la méta-analyse et le journal « Du potentiel à l'incarnation ». Les projets qu'elle a déjà archivés s'y retrouvent aussi, repliés sous leur titre — un clic les déplie. Rien de tout cela ne peut être modifié depuis cette page : c'est une lecture seule, un outil pour t'accompagner toi dans ton rôle d'accompagnement.

Sur cette même page, pour chacune des six étapes, un petit encadré te permet d'écrire une **note de coaching** — ton retour sur cette étape précise. Dès que tu cliques sur **Enregistrer**, cette note apparaît directement dans l'app de la personne, en haut de cette étape, sous un titre « Retour de ton accompagnateur » — elle n'a rien à faire pour la voir, et rien à faire non plus pour la faire disparaître (elle ne peut pas la modifier ni la retirer elle-même). Écrire une nouvelle note à la même étape remplace simplement l'ancienne. Ces notes ne s'appliquent qu'au projet actif d'une personne — les projets déjà archivés n'en portent pas.

---

## Pour la suite

- **Chaque personne** garde son propre lien pour toujours (sauf si tu le révoques — il n'y a pas encore de fonction pour ça dans cette première version ; demande si tu en as besoin).
- **Les coûts** : Supabase et Vercel restent gratuits pour cet usage (petit nombre de personnes). Seul l'usage d'Anthropic (les générations par l'IA) coûte quelques sous à chaque fois qu'une personne clique sur un bouton « Générer » — surveille ta consommation sur [console.anthropic.com](https://console.anthropic.com) → **Usage**.
- **Si quelque chose ne fonctionne pas** : dans Vercel, l'onglet **Deployments → (ton dernier déploiement) → Functions** affiche les messages d'erreur du serveur — utile si tu demandes de l'aide à quelqu'un.
