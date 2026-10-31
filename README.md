# PathForge

PathForge contient une application frontend Next.js et une API backend
Node.js/Express. Pour utiliser le cockpit Mentor en local, les deux serveurs
doivent tourner en même temps.

## Prérequis

- Node.js 20 ou plus récent
- Un projet Supabase PathForge configuré
- Un compte Mentor Supabase actif (`role = 'mentor'`, `status = 'active'`)

## Configuration initiale

À effectuer une seule fois après avoir récupéré le projet.

1. Installer les dépendances du backend et du frontend :

   ```powershell
   Set-Location .\backend
   npm install
   Set-Location ..\frontend
   npm install
   Set-Location ..
   ```

2. Configurer le backend. Depuis le dossier `backend`, copie `.env.example` vers
   `.env`, puis renseigne `SUPABASE_URL` et `SUPABASE_ANON_KEY`. L’origine
   frontend doit être `http://localhost:3000` dans `FRONTEND_ORIGIN`.

   ```powershell
   if (-not (Test-Path .\backend\.env)) {
     Copy-Item .\backend\.env.example .\backend\.env
   }
   ```

3. Configurer le frontend. Next.js charge les variables depuis
   `frontend/.env.local`, pas depuis le `.env.local` à la racine du dépôt. Copie
   le modèle, puis renseigne `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` avec les valeurs publiques Supabase. L’URL
   de l’API locale est déjà indiquée dans le modèle.

   ```powershell
   if (-not (Test-Path .\frontend\.env.local)) {
     Copy-Item .\frontend\.env.example .\frontend\.env.local
   }
   ```

Les fichiers `.env` et `.env.local` sont locaux et ignorés par Git. Utilise
uniquement la clé publique Supabase `anon` côté frontend et backend ; ne mets
jamais la clé `service_role`, un mot de passe ou un jeton dans le dépôt.

## Lancer l’application

Ouvre deux terminaux PowerShell depuis la racine du dépôt.

**Terminal 1 — backend :**

```powershell
Set-Location .\backend
npm run dev
```

Le backend écoute sur `http://localhost:4000`. Tu peux vérifier son état à
`http://localhost:4000/health`.

**Terminal 2 — frontend :**

```powershell
Set-Location .\frontend
npm run dev
```

Ouvre ensuite [http://localhost:3000](http://localhost:3000) et connecte-toi
avec un compte Mentor actif. L’API vérifie la session Supabase et le rôle du
compte. Google Calendar est facultatif ; sans configuration OAuth, l’acceptation
d’un rendez-vous fonctionne sans création automatique d’un lien Meet.

Pour arrêter chaque serveur, utilise `Ctrl+C` dans son terminal.

## Documentation détaillée

- [Frontend Mentor](./frontend/README.md) — cockpit, configuration et commandes
  de vérification.
- [Backend Mentor](./backend/README.md) — API, migration Supabase, routes et tests.
