"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Appointment,
  Availability,
  Deliverable,
  MentorDashboard as MentorDashboardData,
  MentorMessage,
  Mentee,
  MenteeDetail,
  Notification,
  mentorApi,
} from "@/lib/mentor-api";
import "./mentor.css";

type Section = "cockpit" | "incubes" | "evaluations" | "agenda" | "resources" | "messages" | "notifications";
type DeliverableWithContext = Deliverable & { incubeId: string; incubeName: string; projectTitle: string };
type Formation = { id: string; title: string; description: string | null; resource_type: "book" | "video" | "document"; resource_url: string | null; created_at: string };

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "cockpit", label: "Vue d’ensemble", icon: "⌂" },
  { id: "incubes", label: "Mes incubés", icon: "♧" },
  { id: "evaluations", label: "Évaluations", icon: "▣" },
  { id: "agenda", label: "Agenda & rendez-vous", icon: "▦" },
  { id: "resources", label: "Ressources", icon: "▤" },
  { id: "messages", label: "Messages", icon: "✉" },
  { id: "notifications", label: "Notifications", icon: "♢" },
];

const weekdays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function MentorDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("cockpit");
  const [token, setToken] = useState("");
  const [dashboard, setDashboard] = useState<MentorDashboardData | null>(null);
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableWithContext[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationForm, setFormationForm] = useState({ title: "", description: "", resourceType: "document" as "book" | "video" | "document" });
  const [formationFile, setFormationFile] = useState<File | null>(null);
  const [selectedMentee, setSelectedMentee] = useState("");
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [availabilityForm, setAvailabilityForm] = useState({ dayOfWeek: "1", startTime: "09:00", endTime: "12:00", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWorkspace = useCallback(async (accessToken: string) => {
    setError("");
    const [dashboardResult, menteeResult, appointmentResult, availabilityResult] = await Promise.all([
      mentorApi<MentorDashboardData>("/dashboard", accessToken),
      mentorApi<{ incubés: Mentee[] }>("/incubes", accessToken),
      mentorApi<{ rendezVous: Appointment[] }>("/appointments", accessToken),
      mentorApi<{ disponibilités: Availability[] }>("/availability", accessToken),
    ]);
    setDashboard(dashboardResult);
    setMentees(menteeResult.incubés);
    setAppointments(appointmentResult.rendezVous);
    setAvailability(availabilityResult.disponibilités);
    setSelectedMentee((current) => current || menteeResult.incubés[0]?.id || "");

    const { data: formationData, error: formationError } = await supabase
      .from("formations")
      .select("id,title,description,resource_type,resource_url,created_at")
      .eq("created_by", dashboardResult.mentor.id)
      .order("created_at", { ascending: false });
    if (formationError) throw formationError;
    setFormations(formationData || []);

    const details = await Promise.all(
      menteeResult.incubés.map((mentee) =>
        mentorApi<MenteeDetail>(`/incubes/${mentee.id}`, accessToken),
      ),
    );
    setDeliverables(details.flatMap((detail) =>
      detail.livrables.map((item) => ({
        ...item,
        incubeId: detail.incubé.id,
        incubeName: fullName(detail.incubé.first_name, detail.incubé.last_name) || "Incubé",
        projectTitle: detail.projets.find((project) => project.id === item.project_id)?.title || "Projet",
      })),
    ));
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError("Impossible de lire la session. Reconnecte-toi.");
        setLoading(false);
        return;
      }
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setToken(data.session.access_token);
      try {
        await loadWorkspace(data.session.access_token);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialize();
    return () => { active = false; };
  }, [loadWorkspace, router]);

  useEffect(() => {
    if (!token || !selectedMentee || section !== "messages") return;
    let active = true;
    mentorApi<{ messages: MentorMessage[] }>(`/messages/${selectedMentee}`, token)
      .then(({ messages: data }) => {
        if (!active) return;
        setMessages(data);
        const unread = data.filter((message) => message.receiver_id === dashboard?.mentor.id && !message.read_at);
        Promise.all(unread.map((message) =>
          mentorApi(`/messages/${message.id}/read`, token, { method: "PUT" }),
        )).then(() => {
          if (!active || unread.length === 0) return;
          setMessages((current) => current.map((message) =>
            unread.some((item) => item.id === message.id)
              ? { ...message, read_at: new Date().toISOString() }
              : message,
          ));
          setDashboard((current) => current ? ({
            ...current,
            stats: { ...current.stats, messagesNonLus: Math.max(0, current.stats.messagesNonLus - unread.length) },
          }) : current);
        }).catch((readError: unknown) => { if (active) setError(errorMessage(readError)); });
      })
      .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); });

    const channel = supabase
      .channel(`mentor-messages-${selectedMentee}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (!active) return;
        const changed = (payload.new || payload.old) as Partial<MentorMessage>;
        if (
          (changed.sender_id === selectedMentee && changed.receiver_id === dashboard?.mentor.id)
          || (changed.sender_id === dashboard?.mentor.id && changed.receiver_id === selectedMentee)
        ) {
          void mentorApi<{ messages: MentorMessage[] }>(`/messages/${selectedMentee}`, token)
            .then(({ messages: data }) => {
              if (active) setMessages(data);
            })
            .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); });
        }
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [dashboard?.mentor.id, section, selectedMentee, token]);

  useEffect(() => {
    if (!token || !dashboard?.mentor.id) return;
    const channel = supabase
      .channel(`mentor-notifications-${dashboard.mentor.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        const changed = (payload.new || payload.old) as Partial<Notification & { user_id: string }>;
        if (changed.user_id !== dashboard.mentor.id) return;
        void Promise.all([
          mentorApi<MentorDashboardData>("/dashboard", token),
          mentorApi<{ rendezVous: Appointment[] }>("/appointments", token),
        ])
          .then(([data, appointmentData]) => {
            setDashboard(data);
            setAppointments(appointmentData.rendezVous);
          })
          .catch((loadError: unknown) => setError(errorMessage(loadError)));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dashboard?.mentor.id, token]);

  const menteeById = useMemo(() => new Map(mentees.map((mentee) => [mentee.id, mentee])), [mentees]);
  const pendingDeliverables = useMemo(
    () => deliverables.filter((deliverable) => !deliverable.feedback_mentor),
    [deliverables],
  );
  const upcomingAppointments = useMemo(
    () => appointments.filter((appointment) =>
      appointment.status !== "rejected"
      && appointment.status !== "cancelled"
      && new Date(appointment.date_time) >= new Date(),
    ),
    [appointments],
  );
  const reservedAppointments = useMemo(
    () => appointments.filter((appointment) =>
      appointment.status === "accepted"
      && new Date(appointment.date_time) > new Date(),
    ),
    [appointments],
  );
  const selectedMenteeInfo = menteeById.get(selectedMentee);

  async function perform<T>(key: string, action: () => Promise<T>, successMessage: string, then?: (result: T) => void) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await action();
      then?.(result);
      setNotice(successMessage);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusy("");
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>, deliverable: DeliverableWithContext) {
    event.preventDefault();
    const feedback = feedbackDrafts[deliverable.id]?.trim();
    if (!feedback) {
      setError("Écris un commentaire avant d’envoyer ton évaluation.");
      return;
    }
    await perform(
      deliverable.id,
      () => mentorApi(`/deliverables/${deliverable.id}/feedback`, token, {
        method: "PUT",
        body: JSON.stringify({ feedback }),
      }),
      "Évaluation envoyée à l’incubé.",
      () => {
        setDeliverables((current) => current.map((item) =>
          item.id === deliverable.id ? { ...item, feedback_mentor: feedback } : item,
        ));
        setFeedbackDrafts((current) => ({ ...current, [deliverable.id]: "" }));
      },
    );
  }

  async function downloadDeliverable(deliverable: DeliverableWithContext) {
    setBusy(deliverable.id);
    setError("");
    setNotice("");
    const documentWindow = window.open("about:blank", "_blank");
    try {
      const result = await mentorApi<{ url: string }>(`/deliverables/${deliverable.id}/download`, token);
      if (documentWindow) {
        documentWindow.opener = null;
        documentWindow.location.href = result.url;
      } else {
        window.location.assign(result.url);
      }
      setNotice("Le document est prêt au téléchargement.");
    } catch (downloadError) {
      documentWindow?.close();
      setError(errorMessage(downloadError));
    } finally {
      setBusy("");
    }
  }

  async function updateAppointment(appointment: Appointment, status: "accepted" | "rejected") {
    await perform(
      appointment.id,
      () => mentorApi<{ rendezVous: Appointment }>(
        `/appointments/${appointment.id}`,
        token,
        { method: "PATCH", body: JSON.stringify({ status }) },
      ),
      status === "accepted" ? "Rendez-vous accepté." : "Demande refusée.",
      (result) => {
        const updated = result;
        setAppointments((current) => current.map((item) =>
          item.id === appointment.id ? updated.rendezVous : item,
        ));
      },
    );
  }

  async function cancelAppointment(appointment: Appointment) {
    await perform(
      appointment.id,
      () => mentorApi<{ rendezVous: Appointment }>(`/appointments/${appointment.id}`, token, { method: "DELETE" }),
      "Rendez-vous annulé. Le créneau est de nouveau disponible.",
      (result) => setAppointments((current) => current.map((item) =>
        item.id === appointment.id ? result.rendezVous : item,
      )),
    );
  }

  async function addAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(
      "availability",
      () => mentorApi<{ disponibilité: Availability }>("/availability", token, {
        method: "POST",
        body: JSON.stringify({
          dayOfWeek: Number(availabilityForm.dayOfWeek),
          startTime: availabilityForm.startTime,
          endTime: availabilityForm.endTime,
          timeZone: availabilityForm.timeZone,
        }),
      }),
      "Créneau ajouté à tes disponibilités.",
      (result) => setAvailability((current) => [...current, result.disponibilité]
        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))),
    );
  }

  async function removeAvailability(item: Availability) {
    await perform(
      item.id,
      () => mentorApi(`/availability/${item.id}`, token, { method: "DELETE" }),
      "Créneau supprimé.",
      () => setAvailability((current) => current.filter((entry) => entry.id !== item.id)),
    );
  }

  async function depositFormation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = formationForm.title.trim();
    if (!title) {
      setError("Indique le titre de la formation.");
      return;
    }
    if (!formationFile) {
      setError("Sélectionne un livre, une vidéo ou un document.");
      return;
    }

    await perform(
      "formation",
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const mentorId = sessionData.session?.user.id;
        if (!mentorId) throw new Error("Session Mentor invalide.");

        const safeName = formationFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const objectPath = `${mentorId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("formations")
          .upload(objectPath, formationFile, { upsert: false });
        if (uploadError) throw uploadError;

        const { data, error: insertError } = await supabase
          .from("formations")
          .insert({
            title,
            description: formationForm.description.trim() || null,
            resource_type: formationForm.resourceType,
            resource_url: objectPath,
            created_by: mentorId,
          })
          .select("id,title,description,resource_type,resource_url,created_at")
          .single();
        if (insertError) throw insertError;
        return data as Formation;
      },
      "Formation déposée et disponible pour les incubés.",
      (formation) => {
        setFormations((current) => [formation, ...current]);
        setFormationForm({ title: "", description: "", resourceType: "document" });
        setFormationFile(null);
      },
    );
  }

  async function downloadFormation(formation: Formation) {
    setBusy(formation.id);
    setError("");
    setNotice("");
    try {
      if (!formation.resource_url) throw new Error("Cette formation n’a pas de fichier associé.");
      const { data, error: signedUrlError } = await supabase.storage
        .from("formations")
        .createSignedUrl(formation.resource_url, 300);
      if (signedUrlError) throw signedUrlError;
      if (!data?.signedUrl) throw new Error("Impossible de générer le lien de téléchargement.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      setNotice("Document de formation prêt.");
    } catch (downloadError) {
      setError(errorMessage(downloadError));
    } finally {
      setBusy("");
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageText.trim();
    if (!content || !selectedMentee) return;
    await perform(
      "message",
      () => mentorApi<{ message: MentorMessage }>("/messages", token, {
        method: "POST",
        body: JSON.stringify({ incubeId: selectedMentee, content }),
      }),
      "Message envoyé.",
      (result) => {
        setMessages((current) => [...current, result.message]);
        setMessageText("");
      },
    );
  }

  async function markNotificationRead(notification: Notification) {
    await perform(
      notification.id,
      () => mentorApi(`/notifications/${notification.id}/read`, token, { method: "PUT" }),
      "Notification marquée comme lue.",
      () => setDashboard((current) => current ? ({
        ...current,
        alertes: current.alertes.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item),
      }) : current),
    );
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError("La déconnexion a échoué. Réessaie.");
      return;
    }
    router.replace("/login");
  }

  if (loading) {
    return <main className="mentor-loading"><span className="loading-spinner" />Chargement de ton espace Mentor…</main>;
  }

  if (error && !dashboard) {
    return (
      <main className="mentor-login-required">
        <div className="error-card">
          <div className="brand-mark">PF</div>
          <h1>Connexion au cockpit impossible</h1>
          <p>{error}</p>
          <button className="primary-button" onClick={() => router.replace("/login")}>Retour à la connexion</button>
        </div>
      </main>
    );
  }

  const mentorName = dashboard ? fullName(dashboard.mentor.firstName, dashboard.mentor.lastName) : "Mentor";
  const title = sections.find((item) => item.id === section)?.label ?? "Vue d’ensemble";

  return (
    <div className="mentor-app">
      <aside className="mentor-sidebar">
        <a className="brand" href="/mentor" onClick={(event) => { event.preventDefault(); setSection("cockpit"); }}>
          <span className="brand-mark">PF</span><span><strong>PathForge</strong><small>PLATEFORME SAAS</small></span>
        </a>
        <div className="sidebar-heading">ESPACE MENTOR</div>
        <nav className="mentor-nav" aria-label="Navigation Mentor">
          {sections.map((item) => (
            <button key={item.id} className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => setSection(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "evaluations" && pendingDeliverables.length > 0 && <span className="nav-count">{pendingDeliverables.length}</span>}
              {item.id === "messages" && (dashboard?.stats.messagesNonLus || 0) > 0 && <span className="nav-count">{dashboard?.stats.messagesNonLus}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini"><span className="avatar">{initials(mentorName)}</span><span><strong>{mentorName}</strong><small>Mentor actif</small></span><i className="online-dot" /></div>
          <button className="sidebar-logout" onClick={() => void signOut()}>↪ Déconnexion</button>
        </div>
      </aside>

      <main className="mentor-main">
        <header className="mentor-topbar">
          <div className="breadcrumb"><span>PathForge</span><b>/</b><strong>{title}</strong></div>
          <div className="topbar-actions"><span className="role-pill">ESPACE MENTOR</span><button className="topbar-avatar" aria-label="Se déconnecter" onClick={() => void signOut()}>{initials(mentorName)}</button></div>
        </header>

        <div className="mentor-content">
          {error && <div className="banner banner-error" role="alert"><span>{error}</span><button onClick={() => setError("")}>Fermer</button></div>}
          {notice && <div className="banner banner-success" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>Fermer</button></div>}

          {section === "cockpit" && (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="pulse-dot" /> COACHING ACTIF</div>
                  <h1>Bonjour {dashboard?.mentor.firstName || mentorName} <span aria-hidden="true">👋</span></h1>
                  <p className="welcome-subtitle">Ton espace de suivi et d’accompagnement des incubés.</p>
                </div>
                <div className="welcome-actions">
                  <button className="secondary-button" onClick={() => setSection("agenda")}>▦ Gérer mes disponibilités</button>
                  <button className="primary-button" onClick={() => setSection("evaluations")}>✎ Évaluer un livrable</button>
                </div>
              </div>

              <div className="stat-grid">
                <StatCard icon="♧" value={dashboard?.stats.incubésSuivis ?? 0} label="Incubés accompagnés" caption={`${mentees.reduce((sum, item) => sum + item.projets.length, 0)} projets suivis`} tone="teal" />
                <StatCard icon="▦" value={dashboard?.stats.rendezVousSemaine ?? 0} label="Rendez-vous cette semaine" caption="Demandes et sessions planifiées" tone="blue" />
                <StatCard icon="▣" value={pendingDeliverables.length} label="Livrables à évaluer" caption="En attente de ton retour" tone="coral" />
                <StatCard icon="✉" value={dashboard?.stats.messagesNonLus ?? 0} label="Messages non lus" caption="Conversations incubés" tone="gold" />
              </div>

              <div className="overview-grid">
                <section className="panel next-session-panel">
                  <div className="panel-heading"><div><span className="panel-kicker light">PROCHAIN RENDEZ-VOUS</span><h2>{upcomingAppointments[0] ? "À venir" : "Pas de rendez-vous imminent"}</h2></div><span className="live-tag">● AGENDA</span></div>
                  {upcomingAppointments[0] ? (
                    <AppointmentFeature
                      appointment={upcomingAppointments[0]}
                      menteeName={menteeName(menteeById, upcomingAppointments[0].incube_id)}
                      busy={busy === upcomingAppointments[0].id}
                      onAccept={() => void updateAppointment(upcomingAppointments[0], "accepted")}
                      onReject={() => void updateAppointment(upcomingAppointments[0], "rejected")}
                    />
                  ) : <p className="empty-light">Les prochains rendez-vous confirmés et demandes reçues apparaîtront ici.</p>}
                  <button className="text-link light-link" onClick={() => setSection("agenda")}>Ouvrir l’agenda <span>→</span></button>
                </section>

                <section className="panel schedule-panel">
                  <div className="panel-heading"><div><h2>Cette semaine</h2><p className="panel-subtitle">Tes prochains rendez-vous</p></div><button className="text-link" onClick={() => setSection("agenda")}>Voir l’agenda →</button></div>
                  <AppointmentList
                    appointments={upcomingAppointments.slice(0, 4)}
                    menteeById={menteeById}
                    onSelect={() => setSection("agenda")}
                  />
                </section>
              </div>

              <section className="section-block">
                <div className="section-heading"><div><h2>Mes incubés & progression</h2><p>Un aperçu de leur avancement et de tes prochains suivis.</p></div><button className="text-link" onClick={() => setSection("incubes")}>Voir tous les incubés ({mentees.length}) →</button></div>
                {mentees.length ? <MenteeGrid mentees={mentees.slice(0, 4)} onSelect={() => setSection("incubes")} /> : <EmptyState title="Aucun incubé assigné" detail="Les incubés associés à tes projets apparaîtront ici." />}
              </section>

              <div className="overview-grid lower-grid">
                <section className="panel">
                  <div className="panel-heading"><div><h2>Livrables à annoter</h2><p className="panel-subtitle">Feedback à transmettre aux incubés</p></div><button className="text-link" onClick={() => setSection("evaluations")}>Tout voir →</button></div>
                  <DeliverableList deliverables={pendingDeliverables.slice(0, 3)} busy={busy} feedbackDrafts={feedbackDrafts} setFeedbackDrafts={setFeedbackDrafts} onSubmit={submitFeedback} onDownload={downloadDeliverable} />
                </section>
                <section className="panel">
                  <div className="panel-heading"><div><h2>À suivre</h2><p className="panel-subtitle">Notifications récentes</p></div><button className="text-link" onClick={() => setSection("notifications")}>Tout voir →</button></div>
                  <NotificationList notifications={dashboard?.alertes || []} onRead={markNotificationRead} busy={busy} compact />
                </section>
              </div>
            </>
          )}

          {section === "incubes" && (
            <SectionPage title="Mes incubés" description="Retrouve les projets assignés et la progression des incubés." count={`${mentees.length} incubé${mentees.length === 1 ? "" : "s"}`}>
              {mentees.length ? <MenteeGrid mentees={mentees} actionLabel="Contacter →" onSelect={(id) => { setSelectedMentee(id); setSection("messages"); }} /> : <EmptyState title="Aucun incubé assigné" detail="Aucun projet n’est actuellement associé à ton compte Mentor." />}
            </SectionPage>
          )}

          {section === "evaluations" && (
            <SectionPage title="Évaluations & livrables" description="Consulte les documents transmis, télécharge-les et envoie ton feedback." count={`${pendingDeliverables.length} en attente`}>
              {deliverables.length ? <DeliverableList deliverables={deliverables} busy={busy} feedbackDrafts={feedbackDrafts} setFeedbackDrafts={setFeedbackDrafts} onSubmit={submitFeedback} onDownload={downloadDeliverable} showFeedback /> : <EmptyState title="Aucun livrable reçu" detail="Les livrables des incubés assignés apparaîtront ici dès leur dépôt." />}
            </SectionPage>
          )}

          {section === "resources" && (
            <SectionPage title="Ressources" description="Dépose des formations et retrouve les documents transmis par tes incubés." count={`${formations.length + deliverables.length} ressource(s)`}>
              <div className="formation-layout">
                <section className="panel formation-form-panel">
                  <div className="panel-heading"><div><h2>Ajouter une formation</h2><p className="panel-subtitle">Livre, vidéo ou document pédagogique</p></div></div>
                  <form className="formation-form" onSubmit={(event) => void depositFormation(event)}>
                    <label>Titre<input value={formationForm.title} onChange={(event) => setFormationForm((current) => ({ ...current, title: event.target.value }))} maxLength={200} placeholder="Ex. Guide du pitch deck" required /></label>
                    <label>Type<select value={formationForm.resourceType} onChange={(event) => setFormationForm((current) => ({ ...current, resourceType: event.target.value as "book" | "video" | "document" }))}><option value="document">Document</option><option value="book">Livre</option><option value="video">Vidéo</option></select></label>
                    <label>Description<textarea value={formationForm.description} onChange={(event) => setFormationForm((current) => ({ ...current, description: event.target.value }))} maxLength={1000} placeholder="Objectif de la formation…" /></label>
                    <label>Fichier<input type="file" accept=".pdf,.epub,.doc,.docx,.ppt,.pptx,.mp4,.mov,.webm" onChange={(event) => setFormationFile(event.target.files?.[0] || null)} required /></label>
                    <button className="primary-button full-button" disabled={busy === "formation"}>{busy === "formation" ? "Dépôt…" : "＋ Déposer la formation"}</button>
                  </form>
                </section>
                <section className="panel formation-library-panel">
                  <div className="panel-heading"><div><h2>Mes ressources</h2><p className="panel-subtitle">Vidéos, livres et documents déposés pour tes incubés</p></div></div>
                  {formations.length ? <FormationList formations={formations} busy={busy} onDownload={downloadFormation} /> : <p className="empty-copy">Aucune formation déposée.</p>}
                </section>
              </div>
              {deliverables.length ? <section className="panel incubed-resource-panel"><div className="panel-heading"><div><h2>Documents des incubés</h2><p className="panel-subtitle">Livrables reçus dans tes projets</p></div></div><ResourceList deliverables={deliverables} busy={busy} onDownload={downloadDeliverable} /></section> : null}
            </SectionPage>
          )}

          {section === "agenda" && (
            <SectionPage title="Agenda & rendez-vous" description="Traite les demandes de rendez-vous et définis tes créneaux de disponibilité." count={`${appointments.filter((item) => item.status === "pending").length} demande(s) en attente`}>
              <div className="agenda-layout">
                <section className="panel"><div className="panel-heading"><div><h2>Rendez-vous</h2><p className="panel-subtitle">Demandes et sessions à venir</p></div></div>
                  <AppointmentList appointments={appointments} menteeById={menteeById} busy={busy} onAccept={(item) => void updateAppointment(item, "accepted")} onReject={(item) => void updateAppointment(item, "rejected")} onCancel={(item) => void cancelAppointment(item)} detailed />
                </section>
                <section className="panel availability-panel"><div className="panel-heading"><div><h2>Mes disponibilités</h2><p className="panel-subtitle">Créneaux récurrents proposés</p></div></div>
                  {availability.length ? <ul className="availability-list">{availability.map((item) => <li key={item.id}><span className="availability-day">{weekdays[item.day_of_week]}</span><span>{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}<small>{item.time_zone}</small></span><button className="icon-button danger-text" aria-label="Supprimer le créneau" disabled={busy === item.id} onClick={() => void removeAvailability(item)}>×</button></li>)}</ul> : <p className="empty-copy">Tu n’as pas encore ajouté de créneaux.</p>}
                  <div className="reserved-slots">
                    <h3>Créneaux réservés</h3>
                    {reservedAppointments.length ? <ul className="availability-list">{reservedAppointments.map((appointment) => {
                      const isPending = appointment.status === "pending";
                      const timeZone = availability.find((item) => matchesAvailability(appointment.date_time, item))?.time_zone || "Europe/Paris";
                      return <li key={appointment.id}><span className="availability-day">{formatInTimeZone(appointment.date_time, timeZone)}</span><span>{menteeName(menteeById, appointment.incube_id)}<small>{isPending ? "En attente de ta réponse" : "Confirmé"}{appointment.incube_message ? " · Proposition de l’incubé" : " · Créneau choisi"}</small></span>{isPending && <div className="appointment-actions"><button className="accept-button" disabled={busy === appointment.id} onClick={() => void updateAppointment(appointment, "accepted")}>Accepter</button><button className="reject-button" disabled={busy === appointment.id} onClick={() => void updateAppointment(appointment, "rejected")}>Refuser</button></div>}</li>;
                    })}</ul> : <p className="empty-copy">Aucun créneau réservé pour le moment.</p>}
                  </div>
                  <form className="availability-form" onSubmit={(event) => void addAvailability(event)}>
                    <label>Jour<select value={availabilityForm.dayOfWeek} onChange={(event) => setAvailabilityForm({ ...availabilityForm, dayOfWeek: event.target.value })}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
                    <div className="time-fields"><label>De<input type="time" value={availabilityForm.startTime} onChange={(event) => setAvailabilityForm({ ...availabilityForm, startTime: event.target.value })} required /></label><label>À<input type="time" value={availabilityForm.endTime} onChange={(event) => setAvailabilityForm({ ...availabilityForm, endTime: event.target.value })} required /></label></div>
                    <label>Fuseau horaire<input value={availabilityForm.timeZone} onChange={(event) => setAvailabilityForm({ ...availabilityForm, timeZone: event.target.value })} required /></label>
                    <p className="availability-hint">Les incubés pourront réserver chaque plage horaire telle quelle. La durée dépend donc de l’intervalle que tu définis.</p>
                    <button className="primary-button full-button" disabled={busy === "availability"}>＋ Ajouter un créneau</button>
                  </form>
                </section>
              </div>
            </SectionPage>
          )}

          {section === "messages" && (
            <SectionPage title="Messages" description="Échange directement avec les incubés qui te sont assignés." count={`${dashboard?.stats.messagesNonLus || 0} non lu(s)`}>
              <section className="panel messaging-panel">
                <aside className="conversation-sidebar"><h2>Conversations</h2>{mentees.length ? mentees.map((mentee) => <button key={mentee.id} className={selectedMentee === mentee.id ? "conversation-choice selected" : "conversation-choice"} onClick={() => setSelectedMentee(mentee.id)}><span className="avatar">{initials(fullName(mentee.first_name, mentee.last_name))}</span><span><strong>{fullName(mentee.first_name, mentee.last_name) || "Incubé"}</strong><small>{mentee.projets[0]?.title || "Projet PathForge"}</small></span></button>) : <p className="empty-copy">Aucun incubé à contacter.</p>}</aside>
                <div className="chat-pane">
                  {selectedMenteeInfo ? <>
                    <div className="chat-header"><span className="avatar">{initials(fullName(selectedMenteeInfo.first_name, selectedMenteeInfo.last_name))}</span><div><strong>{fullName(selectedMenteeInfo.first_name, selectedMenteeInfo.last_name) || "Incubé"}</strong><small>{selectedMenteeInfo.projets[0]?.title || "Projet PathForge"}</small></div></div>
                    <div className="chat-messages">{messages.length ? messages.map((message) => <div key={message.id} className={message.sender_id === dashboard?.mentor.id ? "chat-message sent" : "chat-message received"}><p>{message.content}</p><time>{formatDateTime(message.created_at)}</time></div>) : <EmptyState title="Début de conversation" detail="Envoie un premier message à cet incubé." />}</div>
                    <form className="chat-composer" onSubmit={(event) => void sendMessage(event)}><input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Écris ton message…" maxLength={5000} aria-label="Message" /><button className="primary-button" disabled={!messageText.trim() || busy === "message"}>Envoyer ↗</button></form>
                  </> : <EmptyState title="Sélectionne un incubé" detail="Choisis une conversation dans la colonne de gauche." />}
                </div>
              </section>
            </SectionPage>
          )}

          {section === "notifications" && (
            <SectionPage title="Notifications" description="Les alertes liées à ton activité et à tes incubés." count={`${dashboard?.alertes.filter((item) => !item.read_at).length || 0} non lue(s)`}>
              <section className="panel"><NotificationList notifications={dashboard?.alertes || []} onRead={markNotificationRead} busy={busy} /></section>
            </SectionPage>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, value, label, caption, tone }: { icon: string; value: number; label: string; caption: string; tone: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><strong className="stat-value">{value.toString().padStart(2, "0")}</strong><span className="stat-label">{label}</span><small>{caption}</small></article>;
}

function SectionPage({ title, description, count, children }: { title: string; description: string; count: string; children: React.ReactNode }) {
  return <div className="section-page"><div className="section-page-heading"><div><div className="eyebrow">ESPACE MENTOR</div><h1>{title}</h1><p>{description}</p></div><span className="count-pill">{count}</span></div>{children}</div>;
}

function MenteeGrid({ mentees, onSelect, actionLabel = "Voir le suivi →" }: { mentees: Mentee[]; onSelect: (id: string) => void; actionLabel?: string }) {
  return <div className="mentee-grid">{mentees.map((mentee, index) => {
    const name = fullName(mentee.first_name, mentee.last_name) || "Incubé";
    const color = ["blue", "peach", "mint", "violet"][index % 4];
    return <article className="mentee-card" key={mentee.id}>
      <div className="mentee-card-top"><span className={`avatar ${color}`}>{initials(name)}</span><span className={mentee.progression.pourcentage >= 70 ? "status-chip good" : "status-chip"}>{mentee.progression.pourcentage}% complété</span></div>
      <h3>{name}</h3><p className="project-name">{mentee.projets.map((project) => project.title).join(" · ") || "Projet sans titre"}</p>
      <div className="progress-label"><span>Progression du parcours</span><strong>{mentee.progression.pourcentage}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, mentee.progression.pourcentage)}%` }} /></div>
      <div className="mentee-card-footer"><span>{mentee.progression.terminées}/{mentee.progression.total} formations terminées</span><button className="secondary-button small-button" onClick={() => onSelect(mentee.id)}>{actionLabel}</button></div>
    </article>;
  })}</div>;
}

function AppointmentFeature({ appointment, menteeName: name, busy, onAccept, onReject }: { appointment: Appointment; menteeName: string; busy: boolean; onAccept: () => void; onReject: () => void }) {
  return <div className="feature-appointment"><div className="feature-date"><strong>{new Date(appointment.date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{new Date(appointment.date_time).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span></div><h3>{name}</h3><p>{appointment.status === "pending" ? "Demande en attente de confirmation" : "Session de mentorat planifiée"}</p>{appointment.incube_message && <p className="appointment-message">Message de l’incubé : {appointment.incube_message}</p>}{appointment.status === "pending" && new Date(appointment.date_time) > new Date() && <div className="feature-actions"><button className="accept-button" disabled={busy} onClick={onAccept}>Accepter</button><button className="reject-button" disabled={busy} onClick={onReject}>Refuser</button></div>}</div>;
}

function AppointmentList({ appointments, menteeById, onSelect, onAccept, onReject, onCancel, busy, detailed = false }: { appointments: Appointment[]; menteeById: Map<string, Mentee>; onSelect?: () => void; onAccept?: (appointment: Appointment) => void; onReject?: (appointment: Appointment) => void; onCancel?: (appointment: Appointment) => void; busy?: string; detailed?: boolean }) {
  if (!appointments.length) return <p className="empty-copy">Aucun rendez-vous à afficher.</p>;
  return <ul className="appointment-list">{appointments.map((appointment) => <li key={appointment.id} className="appointment-row">
    <button className="appointment-time" onClick={onSelect} disabled={!onSelect}><strong>{new Date(appointment.date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{new Date(appointment.date_time).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span></button>
    <div className="appointment-info"><strong>{menteeName(menteeById, appointment.incube_id)}</strong><small>{appointment.status === "pending" ? new Date(appointment.date_time) > new Date() ? "Demande à confirmer" : "Date passée — sans décision" : appointmentStatusLabel(appointment.status)}</small>{appointment.incube_message && <small className="appointment-message">Message : {appointment.incube_message}</small>}</div>
    <span className={`appointment-status ${appointment.status === "pending" && new Date(appointment.date_time) <= new Date() ? "expired" : appointment.status}`}>{appointment.status === "pending" ? new Date(appointment.date_time) > new Date() ? "En attente" : "Date passée" : appointmentStatusLabel(appointment.status)}</span>
    {detailed && appointment.status === "pending" && new Date(appointment.date_time) > new Date() && <div className="appointment-actions"><button className="accept-button" disabled={busy === appointment.id} onClick={() => onAccept?.(appointment)}>Accepter</button><button className="reject-button" disabled={busy === appointment.id} onClick={() => onReject?.(appointment)}>Refuser</button></div>}
    {detailed && (appointment.status === "pending" || appointment.status === "accepted") && new Date(appointment.date_time) > new Date() && <div className="appointment-actions"><button className="reject-button" disabled={busy === appointment.id} onClick={() => onCancel?.(appointment)}>Annuler le rendez-vous</button></div>}
  </li>)}</ul>;
}

function DeliverableList({ deliverables, busy, feedbackDrafts, setFeedbackDrafts, onSubmit, onDownload, showFeedback = false }: { deliverables: DeliverableWithContext[]; busy: string; feedbackDrafts: Record<string, string>; setFeedbackDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>; onSubmit: (event: FormEvent<HTMLFormElement>, deliverable: DeliverableWithContext) => void; onDownload: (deliverable: DeliverableWithContext) => void; showFeedback?: boolean }) {
  if (!deliverables.length) return <EmptyState title="Rien à évaluer pour le moment" detail="Les nouveaux documents envoyés par tes incubés apparaîtront ici." />;
  return <div className="deliverable-list">{deliverables.map((deliverable) => {
    const fileName = deliverable.file_url?.split(/[\\/]/).pop() || "Document sans nom";
    return <article className="deliverable-card" key={deliverable.id}>
      <div className="deliverable-file-icon">▤</div><div className="deliverable-main"><div className="deliverable-title-row"><div><h3>{fileName}</h3><p>{deliverable.projectTitle} · {deliverable.incubeName} · déposé le {formatDate(deliverable.created_at)}</p></div><span className={deliverable.feedback_mentor ? "status-chip good" : "status-chip pending"}>{deliverable.feedback_mentor ? "Évalué" : "À évaluer"}</span></div>
      {deliverable.feedback_mentor && <div className="existing-feedback"><strong>Ton feedback</strong><p>{deliverable.feedback_mentor}</p></div>}
      <div className="deliverable-actions"><button className="secondary-button small-button" disabled={busy === deliverable.id} onClick={() => void onDownload(deliverable)}>↓ Télécharger le document</button></div>
      {(!deliverable.feedback_mentor || showFeedback) && <form className="feedback-form" onSubmit={(event) => onSubmit(event, deliverable)}><label htmlFor={`feedback-${deliverable.id}`}>{deliverable.feedback_mentor ? "Modifier ton feedback" : "Ton évaluation"}</label><textarea id={`feedback-${deliverable.id}`} value={feedbackDrafts[deliverable.id] ?? deliverable.feedback_mentor ?? ""} onChange={(event) => setFeedbackDrafts((current) => ({ ...current, [deliverable.id]: event.target.value }))} placeholder="Points forts, axes d’amélioration, prochaines étapes…" maxLength={3000} required /><button className="primary-button small-button" disabled={busy === deliverable.id}>{busy === deliverable.id ? "Envoi…" : "Envoyer l’évaluation →"}</button></form>}
      </div>
    </article>;
  })}</div>;
}

function FormationList({ formations, busy, onDownload }: { formations: Formation[]; busy: string; onDownload: (formation: Formation) => void }) {
  const labels = { book: "Livre", video: "Vidéo", document: "Document" };
  return <div className="formation-list">{formations.map((formation) => <article className="formation-row" key={formation.id}>
    <span className="formation-type">{labels[formation.resource_type] || "Document"}</span>
    <div className="formation-info"><strong>{formation.title}</strong>{formation.description && <p>{formation.description}</p>}<small>Ajoutée le {formatDate(formation.created_at)}</small></div>
    <button className="secondary-button small-button" disabled={busy === formation.id} onClick={() => void onDownload(formation)}>↓ Ouvrir</button>
  </article>)}</div>;
}

function ResourceList({ deliverables, busy, onDownload }: { deliverables: DeliverableWithContext[]; busy: string; onDownload: (deliverable: DeliverableWithContext) => void }) {
  return <div className="resource-list">{deliverables.map((item) => <article className="resource-row" key={item.id}><span className="deliverable-file-icon">▤</span><div className="resource-info"><strong>{item.file_url?.split(/[\\/]/).pop() || "Document sans nom"}</strong><span>{item.projectTitle} · {item.incubeName}</span><small>Déposé le {formatDate(item.created_at)} · {item.feedback_mentor ? "Évalué" : "À évaluer"}</small></div><button className="secondary-button small-button" disabled={busy === item.id} onClick={() => void onDownload(item)}>↓ Télécharger</button></article>)}</div>;
}

function NotificationList({ notifications, onRead, busy, compact = false }: { notifications: Notification[]; onRead: (notification: Notification) => void; busy: string; compact?: boolean }) {
  if (!notifications.length) return <EmptyState title="Tout est à jour" detail="Tu n’as aucune nouvelle notification." />;
  return <ul className={compact ? "notification-list compact" : "notification-list"}>{notifications.map((item) => <li key={item.id} className={item.read_at ? "notification-row read" : "notification-row"}><span className="notification-icon">{item.kind === "message" ? "✉" : "♢"}</span><div className="notification-content"><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}<time>{formatDateTime(item.created_at)}</time></div>{!item.read_at && <button className="text-link" disabled={busy === item.id} onClick={() => onRead(item)}>Marquer comme lu</button>}</li>)}</ul>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-state-icon">◌</span><strong>{title}</strong><p>{detail}</p></div>;
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PF";
}

function appointmentStatusLabel(status: string) {
  const normalizedStatus = status.toLowerCase();
  if (["accepted", "accepte", "accepté"].includes(normalizedStatus)) return "Confirmé";
  if (["cancelled", "canceled", "annule", "annulé", "annulee", "annulée"].includes(normalizedStatus)) return "Annulé";
  if (["rejected", "refused", "refuse", "refusé", "refusee", "refusée", "declined"].includes(normalizedStatus)) return "Refusé";
  if (["completed", "termine", "terminé"].includes(normalizedStatus)) return "Terminé";
  if (["pending", "en_attente"].includes(normalizedStatus)) return "En attente";
  return status;
}

function menteeName(mentees: Map<string, Mentee>, id: string) {
  const mentee = mentees.get(id);
  return fullName(mentee?.first_name, mentee?.last_name) || "Incubé";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatInTimeZone(value: string, timeZone: string) {
  return new Date(value).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function matchesAvailability(dateTime: string, availability: Availability) {
  const parts = new Map(
    new Intl.DateTimeFormat("en-US", {
      timeZone: availability.time_zone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(dateTime)).map((part) => [part.type, part.value]),
  );
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.get("weekday") || "");
  const startTime = `${parts.get("hour")}:${parts.get("minute")}`;
  return dayOfWeek === availability.day_of_week && startTime === availability.start_time.slice(0, 5);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}
