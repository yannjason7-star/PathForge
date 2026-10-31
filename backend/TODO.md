# Suivi du projet PathForge

## Backend Mentor

- [x] Créer les routes de l’API Mentor.
- [x] Configurer localement Supabase pour le backend (`backend/.env`, ignoré par Git).
- [x] Ajouter les tests du backend et vérifier le démarrage de l’API.
- [x] Appliquer `supabase/migrations/20261026225300_mentor_backend.sql` au projet Supabase et vérifier les tables, fonctions, politiques Admin et l’activation RLS.
- [ ] Lancer `npm run test:mentor-api` avec un compte Mentor actif pour tester les routes en lecture seule sur les données réelles.
- [x] Reproduire le cockpit Mentor responsive et relier ses sections aux routes de l’API.
- [x] Connecter la connexion frontend à Supabase et transmettre la session à l’API Mentor.
- [x] Lancer les vérifications frontend/API avec un compte Mentor actif et des données réelles.
- [ ] Vérifier l’activation de Supabase Realtime sur la table `messages`.
- [ ] (Facultatif) Configurer Google Calendar et vérifier la création du lien Meet.

## Reste du MVP

- [ ] Finaliser et intégrer les parcours Incubé, Entreprise et Admin.
- [ ] Vérifier les permissions et les parcours complets de chaque rôle.
- [ ] Effectuer les validations de bout en bout et préparer le déploiement.

## Démarrer le backend

Depuis le dossier `backend` : `npm run dev`.

La migration a été appliquée au projet Supabase et vérifiée sans lire de données
utilisateur. Le cockpit frontend est relié aux routes Mentor ; le parcours complet
doit encore être testé localement avec un compte Mentor actif. Ne jamais mettre
une clé `service_role`, un mot de passe ou un jeton personnel dans le dépôt.
