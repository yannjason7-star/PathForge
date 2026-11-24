# PathForge backend

API Node.js/Express pour le parcours Mentor. L’API utilise le jeton Supabase de
l’utilisateur connecté et la clé publique `anon` ; elle ne nécessite pas de clé
`service_role`.

## Démarrage

1. Copier `.env.example` vers `.env` et renseigner `SUPABASE_URL` et
   `SUPABASE_ANON_KEY` avec les valeurs du projet Supabase. Configurer
   `FRONTEND_ORIGIN` avec l’origine du frontend.
2. Appliquer dans l’ordre les migrations
   `supabase/migrations/20261026225300_mentor_backend.sql`,
   `supabase/migrations/20261118143100_remaining_mvp_roles.sql`,
   `supabase/migrations/20261118152500_mentor_formations.sql`,
   `supabase/migrations/20261118222800_audit_trail.sql`,
   `supabase/migrations/20261121180000_appointment_slots.sql`,
   `supabase/migrations/20261121180900_incube_appointment_proposals.sql`,
   `supabase/migrations/20261121184000_future_appointment_decisions.sql` et
   `supabase/migrations/20261121190000_mentor_approval_for_incube_bookings.sql`,
   `supabase/migrations/20261121192000_reopen_future_rejected_appointments.sql`,
   `supabase/migrations/20261121193000_disable_google_meet.sql` et
   `supabase/migrations/20261121203000_normalize_appointment_statuses.sql` au projet
   Supabase, après avoir créé les tables de base décrites dans le modèle
   PathForge (`profiles`, `projects`, `progressions`, `formations`,
   `deliverables`, `appointments`, `messages`).
3. Installer les dépendances et lancer l’API :

   ```sh
   npm install
   npm run dev
   ```

Le serveur écoute sur le port `4000` par défaut. `GET /health` vérifie qu’il est
en cours d’exécution.

## Authentification et accès

Toutes les routes `/api/mentor` attendent
`Authorization: Bearer <jeton_access Supabase>`. Le profil associé doit avoir
`role = 'mentor'` et `status = 'active'`. Les politiques RLS et fonctions SQL
de la migration limitent les lectures aux incubés assignés, conservent les
lectures de supervision pour un administrateur actif et limitent les écritures
aux opérations prévues pour le mentor ou l’incubé.

## Routes Mentor

| Méthode | Route | Fonction |
| --- | --- | --- |
| `GET` | `/api/mentor/dashboard` | Statistiques, prochains rendez-vous et alertes non lues |
| `GET` | `/api/mentor/incubes` | Incubés assignés, projets et progression des formations |
| `GET` | `/api/mentor/incubes/:incubeId` | Profil, progression et livrables d’un incubé assigné |
| `GET` | `/api/mentor/deliverables/:deliverableId/download` | URL Supabase Storage signée, valable 5 minutes |
| `PUT` | `/api/mentor/deliverables/:deliverableId/feedback` | Ajouter un feedback et notifier l’incubé |
| `GET`, `POST`, `DELETE` | `/api/mentor/availability[/:availabilityId]` | Gérer les créneaux récurrents (jour 0 = dimanche, fuseau IANA) |
| `GET` | `/api/mentor/appointments` | Consulter les demandes et rendez-vous |
| `PATCH` | `/api/mentor/appointments/:appointmentId` | Accepter (`{"status":"accepted"}`) ou refuser (`{"status":"rejected"}`) |
| `DELETE` | `/api/mentor/appointments/:appointmentId` | Annuler un rendez-vous à venir et libérer le créneau |
| `GET` | `/api/mentor/messages/:incubeId` | Lire la conversation avec un incubé assigné |
| `POST` | `/api/mentor/messages` | Envoyer `{ "incubeId": "...", "content": "..." }` |
| `PUT` | `/api/mentor/messages/:messageId/read` | Marquer un message reçu comme lu |
| `PUT` | `/api/mentor/notifications/:notificationId/read` | Marquer une alerte comme lue |

Les messages sont enregistrés dans Supabase afin que le frontend puisse les
recevoir en temps réel via Supabase Realtime. Vérifier que la table `messages`
est incluse dans la publication Realtime du projet.

## Modèle de données utilisé

Les noms de tables et colonnes des tables déjà modélisées suivent le schéma
PathForge : `profiles.id/role/status`, `projects.incube_id/mentor_id`,
`progressions.user_id/formation_id/is_completed`,
`deliverables.project_id/file_url/feedback_mentor`,
`appointments.mentor_id/incube_id/date_time/status` et
`messages.sender_id/receiver_id/content`. La migration ajoute les colonnes
nécessaires aux rendez-vous, aux alertes et aux lectures de messages, ainsi que
les tables de disponibilités et de notifications.

Un incubé peut réserver un créneau disponible ou proposer une autre date avec
un message de 500 caractères maximum. Les propositions restent en attente
jusqu’à la décision du mentor.

Les créneaux récurrents définis par le mentor sont proposés pendant les 30 prochains
jours ; l’intervalle choisi par le mentor détermine la durée. Une réservation
par un incubé reste en attente de la décision du mentor et bloque le créneau.
Une réservation ou une annulation est vérifiée côté base afin d’éviter les doubles réservations.

## Tests

```sh
npm test
```

Pour tester les routes protégées avec un compte Mentor actif, démarre d’abord
l’API (`npm run dev`) puis, dans un autre terminal `backend`, lance :

```sh
npm run test:mentor-api
```

Le script demande l’adresse email et le mot de passe dans le terminal. La saisie
du mot de passe est masquée ; il n’est ni écrit dans les logs ni envoyé à PathForge,
et le jeton Supabase reste en mémoire pendant le test local. Le script effectue
uniquement des requêtes `GET` et n’affiche ni le jeton ni les données reçues.
Optionnellement, définir `MENTOR_API_URL` si l’API écoute ailleurs que
`http://localhost:4000`.
