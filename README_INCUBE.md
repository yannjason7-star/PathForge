# PathForge — Module Espace Incubé

Documentation technique du cockpit Incubé (Frontend Next.js App Router & Supabase).
Cette documentation explique l'architecture mise en place, les contraintes de base de données à respecter, et comment le compte Mentor (Nelson) peut interagir avec ce module.

---

## 1. Vue d'ensemble du module

L'espace Incubé est accessible sur la route locale :
👉 `http://localhost:3000/incube`

### Profils de test actuellement liés :
* **Incubé (Jason) :** `7bf38fa8-6f54-4d2e-9d2f-12553280e8c8`
* **Mentor assigné (Nelson) :** `f06a76dd-6135-48d1-af86-8e29e9414693`
* **Projet commun :** "PathForge Tech" (statut : `en_dev`)

---

## 2. Fonctionnalités Implémentées

### A. Structure globale & Sécurité (`/incube`)
* **Layout & Navigation :** Sidebar latérale fixe, fil d'Ariane dynamique.
* **Middleware d'accès (Écran 1) :** Si `profiles.status == 'pending'`, l'accès au tableau de bord est bloqué et l'écran "Compte en cours d'analyse" s'affiche.
* **Header global :** 
  * Calcul automatique de la semaine d'incubation (`created_at`).
  * Modal global d'upload de livrable accessible depuis n'importe quelle page.

### B. Tableau de bord (`/incube`)
* Message de bienvenue dynamique récupéré depuis Supabase (`first_name`).
* Progression globale calculée dynamiquement (`progressions` / `formations`).
* Carte "Prochaine Étape" connectée à la table `deliverables`.
* Carte "Prochain RDV" connectée à `appointments` avec redirection Google Meet conditionnelle.
* Checklist hebdomadaire persistante connectée à la table `tasks`.

### C. Formations (`/incube/formations`)
* Liste dynamique des cours.
* Lecteur vidéo intégré avec simulateur de passage de Quiz.
* Mise à jour instantanée de la table `progressions` au clic sur "Terminer ce module".

### D. Mon Projet (`/incube/projet`)
* Affichage du projet lié au mentor Nelson.
* Upload physique de fichiers PDF vers **Supabase Storage** (Bucket `deliverables`).
* Historique des livrables avec statut dynamique et affichage du feedback rédigé par le mentor.

### E. Mentorat & Agenda (`/incube/mentorat`)
* Formulaire de réservation de rendez-vous avec le mentor Nelson.
* Enregistrement en base avec le statut initial `en_attente`.
* Historique des sessions et lien visio actif une fois validé.

### F. Messagerie en direct (`/incube/messagerie`)
* Chat en temps réel connecté à **Supabase Realtime** (WebSocket).
* Double coche de confirmation de lecture :
  * Grise : message envoyé.
  * Rouge vif (`#ef4444`) : message lu (`is_read = TRUE`).

---

## 3. Guide d'Interaction pour Nelson (Mentor)

Pour que Nelson teste l'interconnexion entre son espace Mentor et cet espace Incubé, voici les actions à réaliser en base de données ou via son API :

### 1. Valider un livrable déposé par l'incubé
Dans la table `public.deliverables` :
* Passer la colonne `status` à `'valide'` ou `'a_refaire'`.
* Ajouter un commentaire d'évaluation dans la colonne `feedback_mentor`.
* *Effet :* L'incubé verra immédiatement le badge vert et ton commentaire sur sa page "Mon Projet".

### 2. Confirmer un rendez-vous demandé par l'incubé
Dans la table `public.appointments` :
* Passer la colonne `status` à `'confirme'`.
* Renseigner le lien visio dans la colonne `meet_link` (ex: `https://meet.google.com/xyz-abcd-jkl`).
* *Effet :* Le bouton "Rejoindre la session" deviendra vert et cliquable sur le tableau de bord de l'incubé.

### 3. Marquer un message comme lu (Accusé de lecture)
Dans la table `public.messages` :
* Passer la colonne `is_read` à `TRUE` pour les messages envoyés par l'incubé (`sender_id = '7bf38fa8-6f54-4d2e-9d2f-12553280e8c8'`).
* *Effet :* Les deux coches grises de l'incubé passent immédiatement en rouge vif en direct sans recharger la page.

---

## 4. Règles SQL & Contraintes Strictes (À respecter)

Pour éviter les erreurs `23514` (violation de contraintes `CHECK`), les colonnes de statut doivent **strictement** utiliser les valeurs suivantes :

| Table | Colonne | Valeurs autorisées (Exactes) |
| :--- | :--- | :--- |
| `projects` | `status` | `'idee'`, `'en_dev'`, `'lance'` |
| `deliverables` | `status` | `'en_attente'`, `'valide'`, `'a_refaire'` |
| `appointments` | `status` | `'en_attente'`, `'confirme'`, `'annule'` |
| `profiles` | `status` | `'pending'`, `'active'` |

---

## 5. Prérequis Supabase pour tout nouvel arrivant

Si la base de données est réinitialisée ou clonée :
1. **Désactiver temporairement le RLS** pendant le développement pour éviter les erreurs `406 / PGRST116` :
   ```sql
   ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.deliverables DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
   ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;