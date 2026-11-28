# PROTOCOLE DE TEST & AUDIT D'INTÉGRATION E2E — PATHFORGE

> **Objectif :** Valider dans les moindres détails l'ensemble des interactions croisées entre les trois espaces actifs (**Incubé**, **Mentor**, **Admin**) sur la branche `test`.
> **Comptes de test utilisés :**
> - **Incubé (Jason) :** `7bf38fa8-6f54-4d2e-9d2f-12553280e8c8` | URL : `http://localhost:3000/incube`
> - **Mentor (Neil / Nelson) :** `f06a76dd-6135-48d1-af86-8e29e9414693` | URL : `http://localhost:3000/mentor`
> - **Admin (Super Admin) :** `a0000000-0000-0000-0000-000000000000` | URL : `http://localhost:3000/admin`
> - **Backend Node.js :** Port 4000 (`http://localhost:4000/health`)

---

## TITRE 1 : CYCLE DE VIE DU PROJET & MATCHING (Admin ↔ Incubé ↔ Mentor)

### 1.1 Configuration et attribution du binôme
- [X] **Action Admin :** Aller sur `http://localhost:3000/admin/matching`. Vérifier que le projet "PathForge Tech" apparaît dans le tableau avec son statut `en_dev`.
- [X] **Sélection Mentor :** Cliquer sur "Changer" ou "Assigner", sélectionner "Neil" (`f06a76dd...`) dans la liste déroulante et cliquer sur "Confirmer le binôme".
- [X] **Vérification base de données :** Vérifier dans Supabase que la colonne `mentor_id` de la table `projects` contient bien l'UUID de Neil.

### 1.2 Répercussion instantanée côté Incubé
- [X] **Affichage Sidebar Incubé :** Aller sur `http://localhost:3000/incube`. Dans la carte "Mentor Référent" (en bas à gauche ou dans l'en-tête), vérifier que le nom "Neil" apparaît avec son rôle.
- [X] **Accès aux formulaires :** Aller sur `http://localhost:3000/incube/mentorat` et `http://localhost:3000/incube/messagerie`. Vérifier que l'avertissement "Aucun mentor assigné" a disparu et que les formulaires sont débloqués.

### 1.3 Répercussion côté Cockpit Mentor
- [X] **Présence dans la liste :** Aller sur `http://localhost:3000/mentor` puis dans l'onglet "Mes Incubés".
- [X] **Contrôle dossier :** Vérifier que la fiche de Jason apparaît avec le projet "PathForge Tech" et son statut de développement.

### 1.4 Test de dissociation (Cas de rupture de binôme)
- [X] **Retrait Admin :** Sur `/admin/matching`, cliquer sur l'icône rouge de dissociation pour retirer le mentor du projet.
- [X] **Résilience Incubé :** Rafraîchir `/incube/mentorat`. Vérifier que la page affiche proprement le message de sécurité "Aucun mentor assigné" sans provoquer de crash React.
- [X] **Rétablissement :** Réassigner Neil au projet avant de passer au titre suivant.

---

## TITRE 2 : FLUX DES LIVRABLES & ÉVALUATION (Incubé ↔ Mentor ↔ Admin)

### 2.1 Dépôt d'un livrable par l'Incubé
- [X] **Dépôt via le Header :** Depuis n'importe quelle page (`/incube`), cliquer sur le bouton "+ Nouveau Livrable" dans le Header.
- [X] **Modal d'upload :** Sélectionner un fichier PDF réel et cliquer sur "Soumettre au mentor".
- [] **Vérification Storage :** Vérifier dans Supabase Storage que le fichier est bien présent dans le bucket `deliverables` sous le dossier du projet.
- [ ] **Vérification Table :** Vérifier dans la table `public.deliverables` qu'une nouvelle ligne est créée avec le statut `en_attente`.

### 2.2 Consultation du livrable par l'Incubé
- [ ] **Historique du projet :** Aller sur `http://localhost:3000/incube/projet`.
- [ ] **Nom réel du fichier :** Vérifier que le document apparaît avec son vrai nom de fichier (et non un libellé générique "Document soumis").
- [ ] **Téléchargement test :** Cliquer sur le nom du fichier et vérifier qu'il s'ouvre correctement dans un nouvel onglet du navigateur.
- [ ] **Statut initial :** Vérifier que le badge affiche bien "En attente" avec l'icône horloge orange.

### 2.3 Évaluation et feedback par le Mentor
- [ ] **Accès Mentor :** Se rendre sur le cockpit de Neil (`http://localhost:3000/mentor`).
- [ ] **Consultation du fichier :** Ouvrir le dossier de Jason, repérer le livrable déposé et cliquer sur le lien de téléchargement.
- [ ] **Ajout de feedback :** Saisir un commentaire d'évaluation (ex: "Excellente analyse financière, points validés.") et passer le statut à `valide`.
- [ ] **Enregistrement :** Valider l'évaluation et constater la mise à jour côté mentor.

### 2.4 Répercussion chez l'Incubé et l'Admin
- [ ] **Rendu Incubé :** Retourner sur `http://localhost:3000/incube/projet`. Vérifier que le badge est passé au vert "Validé" et que le bloc vert "Retour du mentor" affiche le commentaire saisi par Neil.
- [ ] **KPI Admin :** Aller sur `http://localhost:3000/admin`. Vérifier que le compteur de la carte "Livrables en attente" a bien décrémenté de 1.

---

## TITRE 3 : AGENDA, CRÉNEAUX RÉCURRENTS & VISIOCONFÉRENCE (Mentor ↔ Incubé ↔ Admin)

### 3.1 Synchronisation des créneaux de disponibilité
- [ ] **Lecture des disponibilités :** Aller sur `http://localhost:3000/incube/mentorat`.
- [ ] **Vérification Calendrier :** Vérifier que le calendrier affiche bien la semaine avec les dates exactes (ex: "Semaine du 23 nov. au 27 nov. 2026").
- [ ] **Créneaux ouverts :** Vérifier que les créneaux récurrents configurés par Neil (Lundi matin et Jeudi après-midi) apparaissent bien sous forme de blocs verts "Disponibles".
- [ ] **Navigation :** Cliquer sur "Semaine suivante" et "Semaine précédente" pour vérifier que les dates et les créneaux s'adaptent dynamiquement.

### 3.2 Réservation et règle stricte de verrouillage
- [ ] **Sélection d'un créneau :** Cliquer sur un bloc disponible (ex: Jeudi à 15:00).
- [ ] **Saisie de l'ordre du jour :** Renseigner obligatoirement l'ordre du jour (ex: "Validation du pitch deck final").
- [ ] **Envoi :** Cliquer sur "Confirmer le créneau". Constater l'enregistrement avec le statut `pending` en base.
- [ ] **Test de la règle de verrouillage :** Vérifier que le formulaire se bloque immédiatement avec le bandeau "Réservation actuellement verrouillée" (interdiction formelle de réserver un 2ème RDV actif tant que celui-ci est en cours).
- [ ] **Blocage du créneau :** Vérifier que le créneau réservé apparaît désormais grisé avec l'icône interdiction ("Réservé") sur la grille.

### 3.3 Traitement par le Mentor (Validation & Lien Meet)
- [ ] **Réception Mentor :** Aller sur le cockpit Mentor (`http://localhost:3000/mentor`) dans l'onglet Agenda.
- [ ] **Détail de la demande :** Vérifier que la demande de Jason est visible avec son ordre du jour.
- [ ] **Acceptation :** Accepter le rendez-vous (statut passe à `accepted`).
- [ ] **Lien de visio :** Renseigner ou générer une URL Google Meet (ex: `https://meet.google.com/test-meet-pf`).

### 3.4 Répercussion en direct chez l'Incubé
- [ ] **Statut Confirmé :** Sur `http://localhost:3000/incube/mentorat`, vérifier que la session affiche le badge vert "Confirmé".
- [ ] **Disparition du bouton Annuler :** Vérifier que le bouton "Annuler" a disparu pour éviter une annulation sauvage une fois validé par le mentor.
- [ ] **Bouton Meet Actif :** Vérifier la présence du bouton "Meet" et cliquer dessus pour s'assurer qu'il ouvre l'URL de visio dans un nouvel onglet.
- [ ] **Tableau de bord Accueil :** Aller sur `http://localhost:3000/incube`. Vérifier que la carte "Prochain RDV Mentor" affiche désormais la date confirmée avec le bouton "Rejoindre la session".

### 3.5 Supervision et arbitrage par l'Admin
- [ ] **Tour de contrôle sessions :** Aller sur `http://localhost:3000/admin/sessions`.
- [ ] **Présence du RDV :** Vérifier que le binôme Jason / Neil apparaît avec la date, l'ordre du jour et le statut "Confirmé".
- [ ] **Test Arbitrage Admin :** Cliquer sur "Modifier Meet", saisir une nouvelle URL et enregistrer. Vérifier que la modification se propage instantanément côté Incubé.

---

## TITRE 4 : MESSAGERIE INSTANTANÉE & CONFIRMATION DE LECTURE (Incubé ↔ Mentor)

### 4.1 Envoi et temps réel côté Incubé
- [ ] **Envoi d'un message :** Sur `http://localhost:3000/incube/messagerie`, saisir un message de test et cliquer sur Envoyer.
- [ ] **Contrôle anti-doublon :** Vérifier que le message apparaît une seule fois dans la discussion (bulle sarcelle à droite).
- [ ] **État initial des coches :** Vérifier que sous le message, les deux coches apparaissent en gris estompé (non lu).

### 4.2 Réception et réponse côté Mentor
- [ ] **Réception en direct :** Sur `http://localhost:3000/mentor`, aller dans Messagerie. Vérifier que le message de Jason s'est affiché sans avoir rechargé la page.
- [ ] **Envoi de réponse :** Neil rédige une réponse et l'envoie.
- [ ] **Affichage Incubé :** Côté Incubé, vérifier que la réponse apparaît instantanément à gauche dans une bulle grise.

### 4.3 Accusé de lecture rouge vif (Style WhatsApp)
- [ ] **Déclenchement lecture :** Quand le message de l'incubé est marqué comme lu (`read_at` mis à jour en base par Neil).
- [ ] **Vérification visuelle :** Vérifier côté Incubé que les deux coches grises basculent immédiatement en **rouge vif (`#ef4444`)** sous les yeux de Jason.

---

## TITRE 5 : SAS DE SÉCURITÉ KYC & DIFFUSION D'ALERTES ADMIN (Admin ↔ Plateforme)

### 5.1 Sas de Sécurité KYC (Blocage et Déblocage de compte)
- [ ] **Mise en attente d'un profil :** Dans Supabase, passer temporairement le statut de Jason à `'pending'`.
- [ ] **Vérification du blocage :** Actualiser `http://localhost:3000/incube`. Vérifier que l'accès est hermétiquement bloqué avec l'écran centré "Compte en cours d'analyse" (Header et Sidebar masqués).
- [ ] **Alerte Admin :** Aller sur `http://localhost:3000/admin`. Vérifier que le bloc KYC affiche "1 compte en attente de validation" avec le nom de Jason.
- [ ] **Validation par l'Admin :** Aller sur `http://localhost:3000/admin/utilisateurs`. Ouvrir la fiche KYC de Jason et cliquer sur "Activer le compte".
- [ ] **Déblocage immédiat :** Recharger `http://localhost:3000/incube`. Constater que le tableau de bord redevient instantanément accessible.

### 5.2 Diffusion d'Alerte Globale (Broadcast Admin)
- [ ] **Émission de l'alerte :** Aller sur `http://localhost:3000/admin/notifications` > Onglet "Diffuser une Alerte".
- [ ] **Paramétrage :** Sélectionner la cible "Incubés seuls", renseigner un titre (ex: "Maintenance planifiée ce soir") et un message détaillé, puis cliquer sur "Diffuser".
- [ ] **Réception Header Incubé :** Aller sur l'espace Incubé (`/incube`). Vérifier que la pastille rouge clignotante s'allume sur la cloche du Header.
- [ ] **Menu déroulant :** Cliquer sur la cloche, constater la présence du message de broadcast avec son horodatage.
- [ ] **Centre de notifications complet :** Aller sur `http://localhost:3000/incube/notifications`. Vérifier que l'alerte apparaît dans la liste officielle, et cliquer sur "Marquer comme lu" pour éteindre la pastille.