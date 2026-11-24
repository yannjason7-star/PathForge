# PathForge — frontend Mentor

## Configuration locale

Le frontend charge les variables d’environnement depuis `frontend/.env.local`.
Copie `.env.example` vers ce fichier et renseigne les valeurs du projet Supabase.
La clé à utiliser côté navigateur est uniquement la clé publique `anon` ; ne mets
jamais la clé `service_role` dans le frontend.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_MENTOR_API_URL=http://localhost:4000
```

Le dépôt PathForge peut déjà contenir ces deux variables Supabase dans son
`.env.local` racine. Next.js ne charge pas automatiquement ce fichier depuis le
dossier `frontend` : recopie les deux valeurs dans `frontend/.env.local`.

## Démarrer l’application

Dans un terminal à la racine `frontend` :

```powershell
npm install
npm run dev
```

Dans un autre terminal, démarre également l’API depuis `backend` avec
`npm run dev`. Ouvre ensuite `http://localhost:3000`. La racine redirige vers
la connexion Mentor.

Connecte-toi avec le compte Mentor Supabase. L’API vérifie que le profil a le
rôle `mentor` et le statut `active`. Le frontend transmet le jeton Supabase de la
session dans l’en-tête `Authorization: Bearer ...` ; aucun mot de passe ni jeton
n’est enregistré dans le code.

## Sections du cockpit

- **Vue d’ensemble** : indicateurs réels, prochains rendez-vous, progression,
  livrables et notifications.
- **Mes incubés** : projets attribués et progression des formations.
- **Évaluations** : téléchargement signé des livrables et envoi de feedback.
- **Agenda & rendez-vous** : demandes de rendez-vous et décisions,
  gestion des disponibilités récurrentes. Les incubés assignés peuvent réserver
  les créneaux proposés sur les 30 prochains jours ; leur réservation attend la
  validation du mentor et le créneau n’est plus sélectionnable entre-temps. Le
  mentor comme l’incubé peuvent annuler un rendez-vous,
  ce qui libère le créneau. Un incubé peut aussi proposer une autre date avec un
  message à son mentor, qui accepte ou refuse la proposition depuis l’agenda.
- **Ressources** : bibliothèque des livres, vidéos et documents pédagogiques
  déposés par le mentor, ainsi que des documents reçus des incubés. Les fichiers
  sont privés et ouverts via une URL temporaire pour les utilisateurs autorisés.
- **Messages** : conversations et envoi de messages aux incubés assignés.
- **Notifications** : lecture des alertes.

Le cockpit se met à jour en temps réel pour les nouveaux messages et
notifications lorsque la publication Supabase Realtime est active pour les
tables `messages` et `notifications`.

Les volumes mensuels de coaching, notes moyennes et tâches personnelles visibles
sur la maquette ne sont pas encore exposés par le modèle/API Mentor ; ils ne sont
donc pas présentés comme des données réelles dans le cockpit.

## Vérification

```powershell
npm run lint
npx tsc --noEmit
npm run build
```
