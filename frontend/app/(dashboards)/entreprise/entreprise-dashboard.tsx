"use client";

/**
 * entreprise-dashboard.tsx — Espace Entreprise (compte 3 : le client PathForge) — VERSION LOCALE.
 *
 * Aucune connexion à une base de données ni à une API : les données viennent de
 * `entreprise-data.ts` et les nouvelles demandes sont gardées dans le navigateur (localStorage).
 *
 * Trois écrans, gérés par l'état `section` :
 *   1. "accueil"      → état du projet + bouton « nouvelle demande »
 *   2. "demande"      → formulaire de demande de devis
 *   3. "facturation"  → historique des devis/factures, pastilles de statut, téléchargement PDF
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BillingDocument,
  DocumentStatus,
  EnterpriseProject,
  NewRequestPayload,
  ProjectPhase,
  STORAGE_KEY,
  budgets,
  company,
  initialDocuments,
  initialProjects,
} from "./entreprise-data";
import "../mentor/mentor.css"; // styles partagés (sidebar, cartes, boutons…) — adapte le chemin
import "./entreprise.css";     // styles propres à l'espace Entreprise

/* ------------------------------------------------------------------ */
/* Constantes et libellés                                              */
/* ------------------------------------------------------------------ */

type Section = "accueil" | "demande" | "facturation";

// Entrées du menu latéral
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "accueil", label: "Tableau de bord", icon: "⌂" },
  { id: "demande", label: "Nouvelle demande", icon: "✎" },
  { id: "facturation", label: "Administratif & facturation", icon: "▤" },
];

// Étapes d'un projet, dans l'ordre (frise de progression)
const phases: { id: ProjectPhase; label: string }[] = [
  { id: "cadrage", label: "Cadrage" },
  { id: "maquettage", label: "Maquettage" },
  { id: "developpement", label: "Développement" },
  { id: "recette", label: "Recette" },
  { id: "livraison", label: "Livraison" },
];

// Texte de la pastille d'état du projet
const phaseLabel: Record<ProjectPhase, string> = {
  cadrage: "En phase de cadrage",
  maquettage: "En phase de maquettage",
  developpement: "En phase de développement",
  recette: "En phase de recette",
  livraison: "En phase de livraison",
};

// Libellés des statuts (les couleurs sont dans entreprise.css)
const statusLabel: Record<DocumentStatus, string> = {
  pending: "En attente",
  to_sign: "Devis à signer",
  paid: "Payé",
};

// Valeurs initiales du formulaire
const emptyForm: NewRequestPayload = { projectName: "", projectType: "web", features: "", budget: budgets[1] };

/* ------------------------------------------------------------------ */
/* Composant principal                                                 */
/* ------------------------------------------------------------------ */

export default function EntrepriseDashboard() {
  const [section, setSection] = useState<Section>("accueil");

  // Données : initialisées depuis entreprise-data.ts, puis éventuellement remplacées par le localStorage
  const [projects] = useState<EnterpriseProject[]>(initialProjects);
  const [documents, setDocuments] = useState<BillingDocument[]>(initialDocuments);
  const [hydrated, setHydrated] = useState(false); // true une fois le localStorage lu

  const [form, setForm] = useState<NewRequestPayload>(emptyForm);
  const [error, setError] = useState("");   // bannière rouge
  const [notice, setNotice] = useState(""); // bannière verte

  /** Au montage : relit les documents mémorisés (ex. demandes ajoutées avant un rechargement). */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDocuments(JSON.parse(saved) as BillingDocument[]);
    } catch {
      // localStorage indisponible ou contenu invalide : on garde les données du fichier
    }
    setHydrated(true);
  }, []);

  /** À chaque modification des documents (après la lecture initiale) : on les mémorise. */
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    } catch {
      // quota dépassé ou mode privé : sans gravité
    }
  }, [documents, hydrated]);

  // Documents triés du plus récent au plus ancien
  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [documents],
  );
  const toSignCount = documents.filter((item) => item.status === "to_sign").length;
  const toPayCount = documents.filter((item) => item.kind === "invoice" && item.status === "pending").length;

  /**
   * Formulaire de demande : crée localement un devis « En attente » pour le projet demandé.
   * Pour brancher un vrai backend plus tard, c'est ici qu'il faudra faire l'appel API.
   */
  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.projectName.trim() || !form.features.trim()) {
      setError("Renseigne le nom du projet et les fonctionnalités attendues.");
      return;
    }
    setError("");

    const year = new Date().getFullYear();
    const newDocument: BillingDocument = {
      id: `d${Date.now()}`,
      reference: `DEV-${year}-${String(documents.length + 1).padStart(3, "0")}`,
      kind: "quote",
      projectTitle: form.projectName.trim(),
      amount: null, // pas encore chiffré
      currency: "EUR",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Simule la notification de l'Administrateur (visible dans la console du navigateur)
    console.info("[Demande de devis → Administrateur]", { ...form, reference: newDocument.reference });

    setDocuments((current) => [newDocument, ...current]);
    setForm(emptyForm);
    setNotice("Demande envoyée. L’équipe PathForge reviendra vers toi avec un devis.");
    setSection("accueil");
  }

  /** Télécharge le PDF d'un document (fichier placé dans `public/`). */
  function downloadDocument(item: BillingDocument) {
    if (!item.pdfUrl) {
      setError(`Aucun PDF n’est encore associé à ${item.reference}.`);
      return;
    }
    setError("");
    window.open(item.pdfUrl, "_blank", "noopener,noreferrer");
  }

  const title = sections.find((item) => item.id === section)?.label ?? "Tableau de bord";

  return (
    <div className="mentor-app">
      {/* ===== Menu latéral (barre en bas sur mobile, voir mentor.css) ===== */}
      <aside className="mentor-sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection("accueil"); }}>
          <span className="brand-mark">PF</span><span><strong>PathForge</strong><small>PLATEFORME SAAS</small></span>
        </a>
        <div className="sidebar-heading">ESPACE ENTREPRISE</div>
        <nav className="mentor-nav" aria-label="Navigation Entreprise">
          {sections.map((item) => (
            <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => setSection(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {/* Badge : nombre de devis à signer */}
              {item.id === "facturation" && toSignCount > 0 && <span className="nav-count">{toSignCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini"><span className="avatar">{initials(company.name)}</span><span><strong>{company.name}</strong><small>Compte client</small></span><i className="online-dot" /></div>
        </div>
      </aside>



      <main className="mentor-main">
        {/* ===== Barre du haut ===== */}
        <header className="mentor-topbar">
          <div className="breadcrumb"><span>PathForge</span><b>/</b><strong>{title}</strong></div>
          <div className="topbar-actions"><span className="role-pill">ESPACE ENTREPRISE</span><span className="topbar-avatar">{initials(company.name)}</span></div>
        </header>

        <div className="mentor-content">
          {/* Bannières de retour utilisateur */}
          {error && <div className="banner banner-error" role="alert"><span>{error}</span><button onClick={() => setError("")}>Fermer</button></div>}
          {notice && <div className="banner banner-success" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>Fermer</button></div>}

          {/* ================= ÉCRAN 1 : TABLEAU DE BORD ================= */}
          {section === "accueil" && (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="pulse-dot" /> PROJET EN COURS</div>
                  <h1>Bonjour {company.contactFirstName || company.name} <span aria-hidden="true">👋</span></h1>
                  <p className="welcome-subtitle">Suis l’avancement de ton projet digital développé par PathForge.</p>
                </div>
                <div className="welcome-actions">
                  <button className="secondary-button" onClick={() => setSection("facturation")}>▤ Devis & factures</button>
                  <button className="primary-button" onClick={() => setSection("demande")}>＋ Faire une nouvelle demande de solution numérique</button>
                </div>
              </div>

              <div className="stat-grid stat-grid-3">
                <StatCard icon="◈" value={projects.length} label="Projets PathForge" caption="Développés pour ton entreprise" tone="teal" />
                <StatCard icon="✎" value={toSignCount} label="Devis à signer" caption="En attente de ta validation" tone="coral" />
                <StatCard icon="▣" value={toPayCount} label="Factures à payer" caption="Paiements en attente" tone="gold" />
              </div>

              {projects.length ? (
                <div className="project-stack">
                  {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
                </div>
              ) : (
                <section className="panel">
                  <EmptyState title="Aucun projet en cours" detail="Lance ta première demande de solution numérique : l’équipe PathForge te répondra avec un devis." />
                  <div className="center-action"><button className="primary-button" onClick={() => setSection("demande")}>＋ Faire une nouvelle demande</button></div>
                </section>
              )}
            </>
          )}

          {/* ================= ÉCRAN 2 : FORMULAIRE DE DEMANDE (DEVIS) ================= */}
          {section === "demande" && (
            <SectionPage title="Nouvelle demande de solution numérique" description="Décris ton besoin : l’Administrateur est notifié et te prépare un devis." count="Devis gratuit">
              <section className="panel request-panel">
                <form className="request-form" onSubmit={submitRequest}>
                  <label>Nom du projet
                    <input value={form.projectName} onChange={(event) => setForm({ ...form, projectName: event.target.value })} placeholder="Ex : Application de suivi de livraisons" maxLength={120} required />
                  </label>

                  {/* Type de solution : 2 cartes cliquables */}
                  <fieldset className="type-fieldset">
                    <legend>Type de solution</legend>
                    <div className="type-options">
                      {([["web", "🖥", "Application Web", "Site, plateforme, back-office"], ["mobile", "📱", "Application Mobile", "iOS & Android"]] as const).map(([value, icon, label, hint]) => (
                        <label key={value} className={form.projectType === value ? "type-option selected" : "type-option"}>
                          <input type="radio" name="projectType" value={value} checked={form.projectType === value} onChange={() => setForm({ ...form, projectType: value })} />
                          <span className="type-icon" aria-hidden="true">{icon}</span>
                          <span><strong>{label}</strong><small>{hint}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label>Fonctionnalités attendues
                    <textarea value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder="Ex : connexion utilisateurs, tableau de bord, paiement en ligne, notifications…" maxLength={4000} rows={6} required />
                  </label>

                  <label>Budget approximatif
                    <select value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })}>
                      {budgets.map((budget) => <option key={budget} value={budget}>{budget}</option>)}
                    </select>
                  </label>

                  <div className="request-actions">
                    <button type="button" className="secondary-button" onClick={() => setSection("accueil")}>Annuler</button>
                    <button className="primary-button">Envoyer la demande →</button>
                  </div>
                </form>
              </section>
            </SectionPage>
          )}

          {/* ================= ÉCRAN 3 : ADMINISTRATIF & FACTURATION ================= */}
          {section === "facturation" && (
            <SectionPage title="Administratif & facturation" description="Retrouve l’historique de tes devis et factures et télécharge-les en PDF." count={`${documents.length} document${documents.length === 1 ? "" : "s"}`}>
              <section className="panel">
                {sortedDocuments.length ? (
                  <div className="table-wrap">
                    <table className="billing-table">
                      <thead><tr><th>Référence</th><th>Projet</th><th>Type</th><th>Date</th><th>Montant</th><th>Statut</th><th /></tr></thead>
                      <tbody>
                        {sortedDocuments.map((item) => (
                          <tr key={item.id}>
                            {/* data-label : libellé utilisé par le CSS pour l'affichage mobile */}
                            <td data-label="Référence"><strong>{item.reference}</strong></td>
                            <td data-label="Projet">{item.projectTitle}</td>
                            <td data-label="Type">{item.kind === "quote" ? "Devis" : "Facture"}</td>
                            <td data-label="Date">{formatDate(item.createdAt)}</td>
                            <td data-label="Montant">{item.amount === null ? "—" : formatAmount(item.amount, item.currency)}</td>
                            <td data-label="Statut"><span className={`status-badge ${item.status}`}><i />{statusLabel[item.status]}</span></td>
                            <td><button className="secondary-button small-button" onClick={() => downloadDocument(item)}>↓ Télécharger</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyState title="Aucun document" detail="Tes devis et factures apparaîtront ici dès leur émission." />}
              </section>
            </SectionPage>
          )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composants d'affichage                                         */
/* ------------------------------------------------------------------ */

/** Carte d'un projet : pastille d'état, barre de progression et frise des 5 étapes. */
function ProjectCard({ project }: { project: EnterpriseProject }) {
  // Étapes avant l'index = terminées, à l'index = en cours
  const currentIndex = phases.findIndex((phase) => phase.id === project.phase);
  return (
    <section className="panel project-card">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">{project.type === "mobile" ? "APPLICATION MOBILE" : "APPLICATION WEB"}</span>
          <h2>{project.title}</h2>
          <p className="panel-subtitle">Mis à jour le {formatDate(project.updatedAt)}{project.managerName ? ` · Suivi par ${project.managerName}` : ""}</p>
        </div>
        <span className="status-chip good">{phaseLabel[project.phase]}</span>
      </div>
      <div className="progress-label"><span>Avancement global</span><strong>{project.progress}%</strong></div>
      <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} /></div>
      <ol className="phase-steps">
        {phases.map((phase, index) => (
          <li key={phase.id} className={index < currentIndex ? "done" : index === currentIndex ? "current" : ""}>
            <span className="phase-dot">{index < currentIndex ? "✓" : index + 1}</span>
            <span>{phase.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Petite carte de statistique (valeur sur 2 chiffres). `tone` = couleur de l'icône. */
function StatCard({ icon, value, label, caption, tone }: { icon: string; value: number; label: string; caption: string; tone: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><strong className="stat-value">{value.toString().padStart(2, "0")}</strong><span className="stat-label">{label}</span><small>{caption}</small></article>;
}

/** Gabarit commun des pages secondaires. */
function SectionPage({ title, description, count, children }: { title: string; description: string; count: string; children: React.ReactNode }) {
  return <div className="section-page"><div className="section-page-heading"><div><div className="eyebrow">ESPACE ENTREPRISE</div><h1>{title}</h1><p>{description}</p></div><span className="count-pill">{count}</span></div>{children}</div>;
}

/** Message affiché quand une liste est vide. */
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-state-icon">◌</span><strong>{title}</strong><p>{detail}</p></div>;
}

/* ------------------------------------------------------------------ */
/* Fonctions utilitaires                                               */
/* ------------------------------------------------------------------ */

/** « Acme Corp » → « AC ». */
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PF";
}

/** Date au format français court : « 13 nov. 2026 ». */
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Montant formaté selon la devise du document. */
function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(amount);
}
