/**
 * entreprise-data.ts — Types + DONNÉES LOCALES de l'espace Entreprise.
 *
 * C'est LE fichier à modifier pour changer ce qui s'affiche : nom de l'entreprise,
 * projets, devis/factures, tranches de budget… Aucun backend n'est nécessaire.
 *
 * Emplacement conseillé : app/entreprise/entreprise-data.ts
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Les 5 étapes de vie d'un projet (frise de progression). */
export type ProjectPhase = "cadrage" | "maquettage" | "developpement" | "recette" | "livraison";

/** Un projet digital développé par PathForge pour l'entreprise. */
export type EnterpriseProject = {
  id: string;
  title: string;
  type: "web" | "mobile";
  phase: ProjectPhase;     // étape actuelle → change la pastille « En phase de… » et la frise
  progress: number;        // avancement global, de 0 à 100
  updatedAt: string;       // date ISO de la dernière mise à jour
  managerName?: string;    // chef de projet PathForge (optionnel)
};

/**
 * Statut d'un document de facturation :
 * - pending : « En attente »     (pastille orange)
 * - to_sign : « Devis à signer » (pastille rouge)
 * - paid    : « Payé »           (pastille verte)
 */
export type DocumentStatus = "pending" | "to_sign" | "paid";

/** Un devis ou une facture (ligne du tableau Administratif & facturation). */
export type BillingDocument = {
  id: string;
  reference: string;          // ex. « DEV-2026-014 »
  kind: "quote" | "invoice";  // devis ou facture
  projectTitle: string;
  amount: number | null;      // null = montant pas encore chiffré (affiché « — »)
  currency: string;           // code ISO : "EUR", "XOF"…
  status: DocumentStatus;
  createdAt: string;
  /**
   * Chemin du PDF à télécharger. Dépose le fichier dans le dossier `public/`
   * de ton projet Next.js : "/documents/DEV-2026-014.pdf" ↔ public/documents/DEV-2026-014.pdf
   * Laisse vide si le PDF n'existe pas encore.
   */
  pdfUrl?: string;
};

/** Données saisies dans le formulaire de demande de devis. */
export type NewRequestPayload = {
  projectName: string;
  projectType: "web" | "mobile";
  features: string;
  budget: string;
};

/* ------------------------------------------------------------------ */
/* Données de démonstration — à adapter                                */
/* ------------------------------------------------------------------ */

/** Entreprise connectée (affichée dans la sidebar et le message de bienvenue). */
export const company = {
  name: "Acme Corp",
  contactFirstName: "Awa",
};

/** Projets de l'entreprise. Mets un tableau vide [] pour voir l'état « aucun projet ». */
export const initialProjects: EnterpriseProject[] = [
  {
    id: "p1",
    title: "Application de suivi de livraisons",
    type: "mobile",
    phase: "maquettage",
    progress: 35,
    updatedAt: "2026-11-10T09:00:00Z",
    managerName: "Jean Dupont",
  },
];

/** Historique des devis et factures. */
export const initialDocuments: BillingDocument[] = [
  {
    id: "d1",
    reference: "DEV-2026-014",
    kind: "quote",
    projectTitle: "Application de suivi de livraisons",
    amount: 4800,
    currency: "EUR",
    status: "to_sign",
    createdAt: "2026-11-05T10:00:00Z",
    pdfUrl: "/documents/DEV-2026-014.pdf",
  },
  {
    id: "d2",
    reference: "FAC-2026-031",
    kind: "invoice",
    projectTitle: "Site vitrine Acme",
    amount: 2400,
    currency: "EUR",
    status: "paid",
    createdAt: "2026-09-18T10:00:00Z",
    pdfUrl: "/documents/FAC-2026-031.pdf",
  },
  {
    id: "d3",
    reference: "FAC-2026-038",
    kind: "invoice",
    projectTitle: "Application de suivi de livraisons",
    amount: 1900,
    currency: "EUR",
    status: "pending",
    createdAt: "2026-11-08T10:00:00Z",
  },
];

/** Tranches de budget proposées dans le formulaire (adapte-les à ta devise). */
export const budgets = [
  "Moins de 2 000 €",
  "2 000 € – 5 000 €",
  "5 000 € – 10 000 €",
  "10 000 € – 25 000 €",
  "Plus de 25 000 €",
  "Je ne sais pas encore",
];

/** Clé utilisée pour mémoriser les modifications dans le navigateur (localStorage). */
export const STORAGE_KEY = "pathforge-entreprise-demo";
