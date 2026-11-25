[README-entreprise.md](https://github.com/user-attachments/files/35413356/README-entreprise.md)
# Espace Entreprise — PathForge

## 1. Présentation

L’espace Entreprise est une interface destinée aux clients de PathForge. Il leur permet de consulter l’avancement de leurs projets numériques, d’envoyer une nouvelle demande de devis et de retrouver leurs devis et factures.

Cette version est une **version locale de démonstration** : elle ne communique avec aucune API ni base de données. Les données de démonstration sont définies dans `entreprise-data.ts`. Les documents de facturation et les nouvelles demandes sont conservés dans le `localStorage` du navigateur.

## 2. Fonctionnalités

### Tableau de bord

La page d’accueil présente :
- le nombre de projets de l’entreprise ;
- le nombre de devis à signer ;
- le nombre de factures en attente de paiement ;
- les projets en cours, leur type et leur responsable éventuel ;
- le pourcentage d’avancement et les étapes du projet.

Les cinq étapes affichées sont :
1. Cadrage
2. Maquettage
3. Développement
4. Recette
5. Livraison

### Nouvelle demande de solution numérique

Le formulaire permet au client de renseigner :
- le nom du projet ;
- le type de solution : application Web ou application Mobile ;
- les fonctionnalités attendues ;
- le budget approximatif.

Le nom du projet et la description des fonctionnalités sont obligatoires. À l’envoi, l’application crée localement un document de type devis avec le statut **En attente**, ajoute ce document à l’historique, réinitialise le formulaire et affiche un message de confirmation.

Dans cette version, la notification à l’administrateur est simulée par un message dans la console du navigateur. Aucun courriel ni appel serveur n’est envoyé.

### Administratif et facturation

Cette rubrique affiche l’historique des devis et factures avec :
- la référence ;
- le projet concerné ;
- le type de document ;
- la date ;
- le montant ;
- le statut ;
- une action de téléchargement PDF.

Les statuts disponibles sont :
- `pending` : En attente ;
- `to_sign` : Devis à signer ;
- `paid` : Payé.

Le bouton de téléchargement ouvre le chemin PDF indiqué dans les données. Si aucun PDF n’est associé au document, un message d’erreur est affiché.

## 3. Organisation des fichiers

Les quatre fichiers de cette fonctionnalité sont :

| Fichier | Rôle |
|---|---|
| `page.tsx` | Point d’entrée Next.js de la page Entreprise. Il affiche le composant `EntrepriseDashboard`. |
| `entreprise-dashboard.tsx` | Composant principal côté client. Il contient la navigation, les trois écrans, le formulaire, les calculs et les interactions. |
| `entreprise-data.ts` | Définit les types TypeScript, les informations de l’entreprise, les projets, les documents, les budgets et la clé du stockage local. |
| `entreprise.css` | Contient les styles propres à l’espace Entreprise et les adaptations pour les petits écrans. |

Le composant importe également `mentor.css` afin de réutiliser les styles communs (barre latérale, cartes, boutons, etc.), puis `entreprise.css` pour les éléments spécifiques à cet espace.

## 4. Installation et intégration dans le projet

Dans un projet Next.js utilisant l’App Router, placez les fichiers dans le dossier suivant :

```text
app/
└── entreprise/
    ├── page.tsx
    ├── entreprise-dashboard.tsx
    ├── entreprise-data.ts
    └── entreprise.css
```

Vérifiez que le fichier de styles partagé existe à l’emplacement correspondant à l’import du composant :

```text
app/
└── mentor/
    └── mentor.css
```

Si votre architecture est différente, adaptez le chemin de l’import `../mentor/mentor.css` dans `entreprise-dashboard.tsx`.

Démarrez ensuite le projet avec les commandes habituelles :

```bash
npm install
npm run dev
```

Ouvrez la route `/entreprise` dans le navigateur.

> Prérequis : un projet Next.js configuré avec React et TypeScript. Le composant `entreprise-dashboard.tsx` utilise les hooks React et doit donc rester un composant client (`"use client"`).

## 5. Personnaliser les données

Pour modifier le contenu de démonstration, ouvrez `entreprise-data.ts`.

### Informations de l’entreprise

Modifiez l’objet `company` :

```ts
export const company = {
  name: "Acme Corp",
  contactFirstName: "Awa",
};
```

- `name` : nom affiché dans la barre latérale et utilisé pour générer les initiales ;
- `contactFirstName` : prénom affiché dans le message de bienvenue.

### Projets

Modifiez le tableau `initialProjects`. Chaque projet possède notamment :
- `id` : identifiant unique ;
- `title` : nom du projet ;
- `type` : `web` ou `mobile` ;
- `phase` : étape actuelle du projet ;
- `progress` : avancement entre 0 et 100 ;
- `updatedAt` : date de dernière mise à jour au format ISO ;
- `managerName` : nom facultatif du responsable.

Pour afficher l’état vide du tableau de bord, remplacez le contenu du tableau par `[]`.

### Devis et factures

Modifiez le tableau `initialDocuments`. Chaque document comprend :
- `id` et `reference` ;
- `kind` : `quote` pour un devis ou `invoice` pour une facture ;
- `projectTitle` ;
- `amount` : montant numérique ou `null` si le montant n’est pas encore défini ;
- `currency` : code de devise, par exemple `EUR` ;
- `status` : `pending`, `to_sign` ou `paid` ;
- `createdAt` : date au format ISO ;
- `pdfUrl` : chemin facultatif du PDF.

### Budgets

Modifiez le tableau `budgets` pour adapter les tranches proposées dans le formulaire.

## 6. Ajouter les fichiers PDF

Les fichiers PDF doivent être placés dans le dossier public de Next.js. Par exemple :

```text
public/
└── documents/
    ├── DEV-2026-014.pdf
    └── FAC-2026-031.pdf
```

Pour associer un PDF à un document, renseignez son chemin public dans `entreprise-data.ts` :

```ts
pdfUrl: "/documents/DEV-2026-014.pdf"
```

Le chemin commence par `/` et correspond à l’emplacement du fichier à partir du dossier `public`.

## 7. Fonctionnement de la sauvegarde locale

La clé `STORAGE_KEY`, définie dans `entreprise-data.ts`, vaut actuellement :

```ts
"pathforge-entreprise-demo"
```

Au chargement du composant, l’application essaie de récupérer les documents enregistrés dans le `localStorage`. Lorsqu’ils changent, elle les y sauvegarde au format JSON.

Conséquences :
- les nouvelles demandes restent visibles après actualisation du navigateur sur le même profil ;
- les données sont propres au navigateur et à son profil ;
- elles ne sont pas partagées entre plusieurs utilisateurs ou appareils ;
- vider les données du site ou supprimer cette entrée du stockage local peut effacer les demandes enregistrées ;
- les projets restent actuellement alimentés par `initialProjects` et ne sont pas sauvegardés dans le `localStorage`.

Pour repartir des documents initiaux de démonstration, supprimez l’entrée `pathforge-entreprise-demo` du stockage local du navigateur, puis rechargez la page.

## 8. Responsive design

Le fichier `entreprise.css` adapte l’interface aux écrans de petite largeur (jusqu’à 720 px notamment) :
- les statistiques passent sur une seule colonne ;
- les choix Web/Mobile du formulaire s’empilent ;
- les boutons du formulaire prennent toute la largeur ;
- le tableau des devis et factures se transforme en présentation par blocs, avec des libellés pour chaque cellule ;
- la frise des étapes peut défiler horizontalement si nécessaire.

La barre latérale et les styles généraux sont réutilisés depuis `mentor.css`.

## 9. Points importants et limites de cette version

Cette version sert à présenter et tester l’interface et ses interactions. Elle ne constitue pas encore un espace client connecté à un système de gestion réel.

Éléments qui restent à développer pour une mise en production :
- connecter les données à une API et à une base de données ;
- associer chaque projet et document au compte de l’entreprise authentifiée ;
- transmettre réellement les demandes à l’administrateur ;
- mettre en place les règles de validation côté serveur ;
- gérer les devis, factures, signatures et paiements depuis le backend ;
- sécuriser l’accès aux documents PDF et vérifier les autorisations avant téléchargement ;
- remplacer les données de démonstration par les données réelles.

Le code prévoit déjà un emplacement logique pour cette évolution : la fonction `submitRequest` dans `entreprise-dashboard.tsx` est l’endroit où l’appel à l’API pourra remplacer la création locale du devis.

## 10. Résumé du parcours utilisateur

1. Le client ouvre `/entreprise`.
2. Il consulte ses projets et leur progression dans le tableau de bord.
3. Il peut ouvrir **Nouvelle demande** et décrire une solution numérique.
4. Après validation, une demande de devis est ajoutée localement à l’historique.
5. Il consulte **Administratif & facturation** pour voir les documents, leurs statuts et les PDF disponibles.

---

**Technologies utilisées :** Next.js, React, TypeScript, CSS et `localStorage` du navigateur.
