# CHECKLIST MVP — ESPACE INCUBÉ

## TITRE 1 : STRUCTURE ET VÉRIFICATION DE SÉCURITÉ (Écran 1)
- [ X] 1.1 Créer le Layout de l'incubé (Sidebar et Header) dans `frontend/app/(dashboards)/incube/layout.tsx`.
- [X] 1.2 Appliquer la variable Mockée (`const currentUserId = "id-incube-001";`) comme point de départ.
- [ X] 1.3 Gérer l'Écran 1 : Affichage de la page "Votre compte est en cours d'analyse" (si le statut du profil est 'pending').

## TITRE 2 : TABLEAU DE BORD / ACCUEIL (Écran 2)
- [ ] 2.1 Afficher un message de bienvenue personnalisé (ex: "Bonjour [Prénom]").
- [ ] 2.2 Créer la barre de progression globale des formations (%).
- [ ] 2.3 Afficher la prochaine étape à réaliser (ex: "Livrable X en attente").
- [ ] 2.4 Afficher la carte du prochain RDV avec le Mentor (s'il y en a un).

## TITRE 3 : ESPACE FORMATIONS (Écran 3)
- [ ] 3.1 Créer l'interface listant les modules sous forme de cartes (Titre, Image, Type : Vidéo/PDF).
- [ ] 3.2 Créer la page de lecture d'une vidéo avec le Player intégré.
- [ ] 3.3 Intégrer le bouton "Marquer comme terminé" (mise à jour de la progression).
- [ ] 3.4 Intégrer une interface de Quiz simple à la fin du module.

## TITRE 4 : ESPACE "MON PROJET" (Écran 4)
- [ ] 4.1 Afficher les informations actuelles du projet (Titre, Description, Statut).
- [ ] 4.2 Créer le formulaire d'upload pour soumettre un Livrable (fichier PDF).
- [ ] 4.3 Créer la zone affichant l'historique des feedbacks écrits par le Mentor.

## TITRE 5 : ESPACE MENTORAT - AGENDA & CHAT (Écran 5)
- [ ] 5.1 Afficher le calendrier avec les créneaux libres du Mentor.
- [ ] 5.2 Intégrer le bouton "Demander un RDV" (crée un RDV en statut 'pending').
- [ ] 5.3 Créer l'interface de Chat en temps réel (type WhatsApp) pour discuter avec le mentor.