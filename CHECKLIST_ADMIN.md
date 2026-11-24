# ROADMAP — ESPACE ADMINISTRATEUR (GESTION SYSTÈME)

## TITRE 1 : STRUCTURE ET NAVIGATION ADMIN
- [X] 1.1 Configurer le layout dédié `frontend/app/(dashboards)/admin/layout.tsx`.
- [X] 1.2 Créer la Sidebar Admin (Navigation : Tour de contrôle, Utilisateurs, Matching, Formations, Facturation).
- [X] 1.3 Créer le Header Admin avec badge "Super Admin" et fil d'Ariane.
- [X] 1.4 Définir l'identifiant Admin mocké pour le développement.

## TITRE 2 : TOUR DE CONTRÔLE (Écran 1 - Accueil)
- [X] 2.1 Calculer et afficher les KPI globaux en temps réel (Total inscrits, projets actifs, CA potentiel).
- [X] 2.2 Créer le panneau d'alerte urgente : "Comptes en attente de validation (KYC)".
- [X] 2.3 Raccourcis d'actions rapides (Ajouter formation, valider un profil).

## TITRE 3 : GESTION DES UTILISATEURS & SÉCURITÉ (Écran 2)
- [X] 3.1 Afficher le tableau de tous les profils avec pagination et recherche.
- [X] 3.2 Mettre en place les filtres par rôle (`incube`, `mentor`, `entreprise`).
- [X] 3.3 Créer la vue détaillée d'un profil "en attente".
- [ ] 3.4 Programmer l'action "Valider le profil" (bascule le statut de 'pending' à 'active' en base).
- [X] 3.5 Programmer l'action "Rejeter / Bloquer le profil".

## TITRE 4 : GESTION DE L'INCUBATION & MATCHING (Écran 3)
- [X] 4.1 Lister les incubés et l'état de leur projet (`projects`).
- [X] 4.2 Afficher la liste déroulante des Mentors disponibles pour chaque projet.
- [X] 4.3 Programmer l'action d'assignation au clic (mise à jour directe de `projects.mentor_id`).
- [ ] 4.4 Historique et statut des binômes Incubé-Mentor.

## TITRE 5 : GESTION DES CONTENUS & FORMATIONS (Écran 4)
- [ ] 5.1 Afficher la liste des formations existantes avec options de suppression/édition.
- [ ] 5.2 Créer le formulaire d'ajout de formation (Titre, description, type vidéo/PDF).
- [ ] 5.3 Gérer l'upload des supports pédagogiques vers Supabase Storage.
- [ ] 5.4 Créer l'interface de saisie des questions pour le Quiz de fin de module.

## TITRE 6 : GESTION ENTREPRISES & DEVIS (Écran 5)
- [ ] 6.1 Lister les formulaires de besoins envoyés par les entreprises clientes.
- [ ] 6.2 Créer le formulaire Admin pour fixer le montant et uploader le devis PDF officiel.
- [ ] 6.3 Mettre à jour le statut dans la table `invoices` (`'en_attente'`, `'paye'`).