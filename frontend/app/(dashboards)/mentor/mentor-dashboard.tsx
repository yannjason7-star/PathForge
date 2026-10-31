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

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "cockpit", label: "Vue d’ensemble", icon: "⌂" },
  { id: "incubes", label: "Mes incubés", icon: "♧" },
  { id: "evaluations", label: "Évaluations", icon: "▣" },
  { id: "agenda", label: "Agenda & visios", icon: "▦" },
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
    return () => { active = false; };
  }, [dashboard?.mentor.id, section, selectedMentee, token]);

  const menteeById = useMemo(() => new Map(mentees.map((mentee) => [mentee.id, mentee])), [mentees]);
  const pendingDeliverables = useMemo(
    () => deliverables.filter((deliverable) => !deliverable.feedback_mentor),
    [deliverables],
  );
  const upcomingAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== "rejected" && new Date(appointment.date_time) >= new Date()),
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
      () => mentorApi<{ rendezVous: Appointment; meetingLinkStatus: string }>(
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
        if (updated.meetingLinkStatus === "not_configured") {
          setNotice("Rendez-vous accepté. Google Calendar n’est pas encore configuré pour créer le lien Meet.");
        }
      },
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
            <SectionPage title="Ressources" description="Retrouve les documents déposés par les incubés qui te sont assignés." count={`${deliverables.length} document(s)`}>
              {deliverables.length ? <ResourceList deliverables={deliverables} busy={busy} onDownload={downloadDeliverable} /> : <EmptyState title="Aucune ressource disponible" detail="Les documents déposés par tes incubés apparaîtront ici." />}
            </SectionPage>
          )}

          {section === "agenda" && (
            <SectionPage title="Agenda & visios" description="Traite les demandes de rendez-vous et définis tes créneaux de disponibilité." count={`${appointments.filter((item) => item.status === "pending").length} demande(s) en attente`}>
              <div className="agenda-layout">
                <section className="panel"><div className="panel-heading"><div><h2>Rendez-vous</h2><p className="panel-subtitle">Demandes et sessions à venir</p></div></div>
                  <AppointmentList appointments={appointments} menteeById={menteeById} busy={busy} onAccept={(item) => void updateAppointment(item, "accepted")} onReject={(item) => void updateAppointment(item, "rejected")} detailed />
                </section>
                <section className="panel availability-panel"><div className="panel-heading"><div><h2>Mes disponibilités</h2><p className="panel-subtitle">Créneaux récurrents proposés</p></div></div>
                  {availability.length ? <ul className="availability-list">{availability.map((item) => <li key={item.id}><span className="availability-day">{weekdays[item.day_of_week]}</span><span>{item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}<small>{item.time_zone}</small></span><button className="icon-button danger-text" aria-label="Supprimer le créneau" disabled={busy === item.id} onClick={() => void removeAvailability(item)}>×</button></li>)}</ul> : <p className="empty-copy">Tu n’as pas encore ajouté de créneaux.</p>}
                  <form className="availability-form" onSubmit={(event) => void addAvailability(event)}>
                    <label>Jour<select value={availabilityForm.dayOfWeek} onChange={(event) => setAvailabilityForm({ ...availabilityForm, dayOfWeek: event.target.value })}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
                    <div className="time-fields"><label>De<input type="time" value={availabilityForm.startTime} onChange={(event) => setAvailabilityForm({ ...availabilityForm, startTime: event.target.value })} required /></label><label>À<input type="time" value={availabilityForm.endTime} onChange={(event) => setAvailabilityForm({ ...availabilityForm, endTime: event.target.value })} required /></label></div>
                    <label>Fuseau horaire<input value={availabilityForm.timeZone} onChange={(event) => setAvailabilityForm({ ...availabilityForm, timeZone: event.target.value })} required /></label>
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
  return <div className="feature-appointment"><div className="feature-date"><strong>{new Date(appointment.date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{new Date(appointment.date_time).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span></div><h3>{name}</h3><p>{appointment.status === "pending" ? "Demande en attente de confirmation" : "Session de mentorat planifiée"}</p>{appointment.meeting_url && <a className="meet-link" href={appointment.meeting_url} target="_blank" rel="noreferrer">↗ Rejoindre Google Meet</a>}{appointment.status === "pending" && <div className="feature-actions"><button className="accept-button" disabled={busy} onClick={onAccept}>Accepter</button><button className="reject-button" disabled={busy} onClick={onReject}>Refuser</button></div>}</div>;
}

function AppointmentList({ appointments, menteeById, onSelect, onAccept, onReject, busy, detailed = false }: { appointments: Appointment[]; menteeById: Map<string, Mentee>; onSelect?: () => void; onAccept?: (appointment: Appointment) => void; onReject?: (appointment: Appointment) => void; busy?: string; detailed?: boolean }) {
  if (!appointments.length) return <p className="empty-copy">Aucun rendez-vous à afficher.</p>;
  return <ul className="appointment-list">{appointments.map((appointment) => <li key={appointment.id} className="appointment-row">
    <button className="appointment-time" onClick={onSelect} disabled={!onSelect}><strong>{new Date(appointment.date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{new Date(appointment.date_time).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span></button>
    <div className="appointment-info"><strong>{menteeName(menteeById, appointment.incube_id)}</strong><small>{appointment.status === "pending" ? "Demande à confirmer" : appointment.status === "accepted" ? "Confirmé" : appointment.status}</small></div>
    <span className={`appointment-status ${appointment.status}`}>{appointment.status === "pending" ? "En attente" : appointment.status === "accepted" ? "Confirmé" : "Terminé"}</span>
    {detailed && appointment.status === "pending" && <div className="appointment-actions"><button className="accept-button" disabled={busy === appointment.id} onClick={() => onAccept?.(appointment)}>Accepter</button><button className="reject-button" disabled={busy === appointment.id} onClick={() => onReject?.(appointment)}>Refuser</button></div>}
    {appointment.meeting_url && <a className="meet-link" href={appointment.meeting_url} target="_blank" rel="noreferrer">Google Meet ↗</a>}
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}
