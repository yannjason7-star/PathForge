"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "../role-dashboard.css";

type Project = { id: string; title: string; status: string | null; mentor_id: string | null };
type Formation = { id: string; title: string | null; description: string | null; resource_type: "book" | "video" | "document"; resource_url: string | null; created_at: string };
type Progression = { id: string; formation_id: string; is_completed: boolean };
type Deliverable = { id: string; project_id: string; file_url: string | null; feedback_mentor: string | null; created_at: string };
type Appointment = { id: string; mentor_id: string; date_time: string; status: string; incube_message: string | null };
type MentorSlot = { date_time: string; end_time: string; time_zone: string; is_booked: boolean };
type Message = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };

export default function IncubePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [mentorSlots, setMentorSlots] = useState<MentorSlot[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projectId, setProjectId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [proposalForm, setProposalForm] = useState({ dateTime: "", message: "" });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,status").eq("id", session.user.id).maybeSingle();
      if (profileError || profile?.role !== "incube" || profile.status !== "active") { router.replace("/login"); return; }
      setUserId(session.user.id);

      const [projectsResult, progressionsResult, formationsResult, deliverablesResult, appointmentsResult] = await Promise.all([
        supabase.from("projects").select("id,title,status,mentor_id").eq("incube_id", session.user.id).order("title"),
        supabase.from("progressions").select("id,formation_id,is_completed").eq("user_id", session.user.id),
        supabase.from("formations").select("id,title,description,resource_type,resource_url,created_at").order("created_at", { ascending: false }),
        supabase.from("deliverables").select("id,project_id,file_url,feedback_mentor,created_at").order("created_at", { ascending: false }),
        supabase.from("appointments").select("id,mentor_id,date_time,status,incube_message").eq("incube_id", session.user.id).order("date_time", { ascending: false }),
      ]);
      if (!active) return;
      const failed = [projectsResult, progressionsResult, formationsResult, deliverablesResult, appointmentsResult].find((result) => result.error);
      if (failed?.error) { setError(failed.error.message); return; }
      setProjects(projectsResult.data || []);
      setProgressions(progressionsResult.data || []);
      setFormations(formationsResult.data || []);
      setDeliverables(deliverablesResult.data || []);
      setAppointments(appointmentsResult.data || []);
      setProjectId(projectsResult.data?.[0]?.id || "");
      const mentorId = projectsResult.data?.find((project) => project.mentor_id)?.mentor_id;
      if (mentorId) {
        const { data: slots, error: slotsError } = await supabase.rpc("get_mentor_slots", { p_mentor_id: mentorId });
        if (slotsError) setError(slotsError.message);
        else setMentorSlots(slots || []);
      }
    })();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const mentorId = projects.find((project) => project.mentor_id)?.mentor_id;
    if (!mentorId) return;
    let active = true;
    supabase.from("messages").select("id,sender_id,receiver_id,content,created_at")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${mentorId}),and(sender_id.eq.${mentorId},receiver_id.eq.${userId})`)
      .order("created_at", { ascending: true }).limit(200)
      .then(({ data, error: messageError }) => {
        if (active) {
          if (messageError) setError(messageError.message);
          else setMessages(data || []);
        }
      });
    return () => { active = false; };
  }, [projects, userId]);

  useEffect(() => {
    const mentorId = projects.find((project) => project.mentor_id)?.mentor_id;
    if (!mentorId) return;
    let active = true;
    const refreshSlots = async () => {
      const [slotsResult, appointmentsResult] = await Promise.all([
        supabase.rpc("get_mentor_slots", { p_mentor_id: mentorId }),
        supabase.from("appointments").select("id,mentor_id,date_time,status,incube_message")
          .eq("incube_id", userId).order("date_time", { ascending: false }),
      ]);
      if (!active) return;
      if (slotsResult.error) setError(slotsResult.error.message);
      else setMentorSlots(slotsResult.data || []);
      if (appointmentsResult.error) setError(appointmentsResult.error.message);
      else setAppointments(appointmentsResult.data || []);
    };
    const interval = window.setInterval(() => void refreshSlots(), 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [projects, userId]);

  async function toggleFormation(progression: Progression) {
    setBusy(progression.id); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("progressions").update({ is_completed: !progression.is_completed }).eq("id", progression.id).eq("user_id", userId);
    if (updateError) setError(updateError.message);
    else {
      setProgressions((current) => current.map((item) => item.id === progression.id ? { ...item, is_completed: !item.is_completed } : item));
      setNotice("Progression enregistrée.");
    }
    setBusy("");
  }

  async function uploadDeliverable(event: FormEvent) {
    event.preventDefault();
    if (!file || !projectId) return;
    setBusy("upload"); setError(""); setNotice("");
    const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("deliverables").upload(path, file, { upsert: false });
    if (uploadError) { setError(uploadError.message); setBusy(""); return; }
    const { data, error: insertError } = await supabase.from("deliverables").insert({ project_id: projectId, file_url: path }).select("id,project_id,file_url,feedback_mentor,created_at").single();
    if (insertError) setError(insertError.message);
    else { setDeliverables((current) => [data, ...current]); setFile(null); setNotice("Livrable déposé."); }
    setBusy("");
  }

  async function requestAppointment(slot: MentorSlot) {
    const mentorId = projects.find((project) => project.mentor_id)?.mentor_id;
    if (!mentorId || slot.is_booked) return;
    setBusy("appointment"); setError(""); setNotice("");
    const { data: appointmentId, error: appointmentError } = await supabase.rpc("book_mentor_slot", {
      p_mentor_id: mentorId,
      p_date_time: slot.date_time,
    });
    if (appointmentError) setError(appointmentError.message);
    else {
      setMentorSlots((current) => current.map((item) => item.date_time === slot.date_time ? { ...item, is_booked: true } : item));
      const { data, error: loadError } = await supabase.from("appointments")
        .select("id,mentor_id,date_time,status,incube_message")
        .eq("id", appointmentId)
        .single();
      if (loadError) setError(`Le créneau a bien été réservé, mais le rendez-vous n’a pas pu être rechargé : ${loadError.message}`);
      else {
        setAppointments((current) => [data, ...current]);
        setNotice("Demande envoyée au mentor. Le créneau est bloqué en attendant sa réponse.");
      }
    }
    setBusy("");
  }

  async function proposeAppointment(event: FormEvent) {
    event.preventDefault();
    const mentorId = projects.find((project) => project.mentor_id)?.mentor_id;
    const message = proposalForm.message.trim();
    const requestedDate = new Date(proposalForm.dateTime);
    if (!mentorId || !proposalForm.dateTime || !message) return;
    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
      setError("Choisis une date et une heure dans le futur.");
      return;
    }

    setBusy("proposal"); setError(""); setNotice("");
    const { data: appointmentId, error: proposalError } = await supabase.rpc("propose_mentor_appointment", {
      p_mentor_id: mentorId,
      p_date_time: requestedDate.toISOString(),
      p_message: message,
    });
    if (proposalError) setError(proposalError.message);
    else {
      const { data, error: loadError } = await supabase.from("appointments")
        .select("id,mentor_id,date_time,status,incube_message")
        .eq("id", appointmentId)
        .single();
      if (loadError) setError(`La proposition a bien été envoyée, mais elle n’a pas pu être rechargée : ${loadError.message}`);
      else {
        setAppointments((current) => [data, ...current]);
        setProposalForm({ dateTime: "", message: "" });
        setNotice("Proposition envoyée au mentor. Elle apparaîtra dans tes rendez-vous après sa réponse.");
      }
    }
    setBusy("");
  }

  async function cancelAppointment(appointment: Appointment) {
    setBusy(appointment.id); setError(""); setNotice("");
    const { error: cancelError } = await supabase.rpc("cancel_appointment", { p_appointment_id: appointment.id });
    if (cancelError) setError(cancelError.message);
    else {
      setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status: "cancelled" } : item));
      setMentorSlots((current) => current.map((item) => item.date_time === appointment.date_time ? { ...item, is_booked: false } : item));
      setNotice("Rendez-vous annulé. Le créneau est de nouveau disponible.");
    }
    setBusy("");
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const mentorId = projects.find((project) => project.mentor_id)?.mentor_id;
    if (!mentorId || !messageText.trim()) return;
    setBusy("message"); setError("");
    const { data, error: messageError } = await supabase.from("messages").insert({
      sender_id: userId, receiver_id: mentorId, content: messageText.trim(),
    }).select("id,sender_id,receiver_id,content,created_at").single();
    if (messageError) setError(messageError.message);
    else { setMessages((current) => [...current, data]); setMessageText(""); }
    setBusy("");
  }

  async function openFormation(formation: Formation) {
    if (!formation.resource_url) {
      setError("Cette formation n’a pas de fichier associé.");
      return;
    }
    setBusy(formation.id); setError("");
    const { data, error: signedUrlError } = await supabase.storage
      .from("formations")
      .createSignedUrl(formation.resource_url, 300);
    if (signedUrlError) setError(signedUrlError.message);
    else if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setBusy("");
  }

  async function signOut() { await supabase.auth.signOut(); router.replace("/login"); }
  const mentorId = projects.find((project) => project.mentor_id)?.mentor_id;
  const progressPercent = progressions.length ? Math.round(progressions.filter((item) => item.is_completed).length / progressions.length * 100) : 0;
  if (!userId) return <main className="role-loading">Chargement…</main>;

  return <main className="role-page"><div className="role-shell">
    <aside className="role-sidebar"><div className="role-brand"><span>PF</span>PathForge</div><nav><span>Mon parcours</span><span>Mes livrables</span><span>Rendez-vous</span><span>Messages</span></nav><button className="role-logout" onClick={() => void signOut()}>Déconnexion</button></aside>
    <div className="role-main"><header className="role-header"><button onClick={() => void signOut()} aria-label="Déconnexion">I</button></header><div className="role-content">
      <div className="role-heading"><div><p>Espace incubé</p><h1>Mon parcours</h1></div></div>
      {error && <div className="role-error">{error}</div>} {notice && <div className="role-notice">{notice}</div>}
      <div className="role-grid"><article className="role-card"><strong>{projects.length}</strong><span>Projet(s)</span></article><article className="role-card"><strong>{progressPercent}%</strong><span>Progression</span></article><article className="role-card"><strong>{deliverables.length}</strong><span>Livrable(s)</span></article></div>
      <section className="role-panel"><h2>Mes projets</h2>{projects.length ? <ul className="role-list">{projects.map((project) => <li key={project.id}><div><strong>{project.title}</strong><div className="role-progress"><span style={{ width: `${progressPercent}%` }} /></div></div><span className="role-status">{project.status || "Actif"}</span></li>)}</ul> : <p>Aucun projet assigné.</p>}</section>
      <section className="role-panel"><h2>Formations</h2>{progressions.length ? <ul className="role-list">{progressions.map((progression) => {
        const formation = formations.find((item) => item.id === progression.formation_id);
        return <li key={progression.id}><span>{formation?.title || "Formation"}</span><button className="role-button secondary" disabled={busy === progression.id} onClick={() => void toggleFormation(progression)}>{progression.is_completed ? "Marquer à faire" : "Marquer terminée"}</button></li>;
      })}</ul> : <p>Aucune formation suivie.</p>}</section>
      <section className="role-panel"><h2>Ressources pédagogiques</h2>{formations.length ? <ul className="role-list">{formations.map((formation) => <li key={formation.id}><div><strong>{formation.title}</strong>{formation.description && <small style={{ display: "block", marginTop: "4px" }}>{formation.description}</small>}</div>{formation.resource_url && <button className="role-button secondary" disabled={busy === formation.id} onClick={() => void openFormation(formation)}>Ouvrir</button>}</li>)}</ul> : <p>Aucune ressource disponible.</p>}</section>
      <section className="role-panel"><h2>Déposer un livrable</h2><form className="role-form" onSubmit={(event) => void uploadDeliverable(event)}><select className="role-select" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select><input className="role-input" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} required/><button className="role-button" disabled={busy === "upload"}>Déposer</button></form></section>
      <section className="role-panel"><h2>Créneaux disponibles avec mon mentor</h2>{mentorSlots.length ? <ul className="role-list">{mentorSlots.map((slot) => <li key={`${slot.date_time}-${slot.time_zone}`} className={slot.is_booked ? "role-slot-booked" : ""}><span>{formatSlot(slot.date_time, slot.time_zone)} – {formatSlot(slot.end_time, slot.time_zone)}</span>{slot.is_booked ? <button className="role-button secondary" disabled>Indisponible</button> : <button className="role-button" disabled={busy === "appointment"} onClick={() => void requestAppointment(slot)}>{busy === "appointment" ? "Envoi…" : "Demander ce créneau"}</button>}</li>)}</ul> : <p>{mentorId ? "Aucun créneau disponible pour le moment." : "Aucun mentor ne t’est assigné pour le moment."}</p>}</section>
      <section className="role-panel"><h2>Proposer un autre rendez-vous</h2><form className="role-form" onSubmit={(event) => void proposeAppointment(event)}><label>Date et heure<input className="role-input" type="datetime-local" value={proposalForm.dateTime} onChange={(event) => setProposalForm((current) => ({ ...current, dateTime: event.target.value }))} required /></label><label>Petit message pour le mentor<textarea className="role-textarea" value={proposalForm.message} onChange={(event) => setProposalForm((current) => ({ ...current, message: event.target.value }))} maxLength={500} placeholder="Explique brièvement le motif ou tes disponibilités…" required /></label><button className="role-button" disabled={busy === "proposal" || !mentorId}>{busy === "proposal" ? "Envoi…" : "Envoyer la proposition"}</button></form></section>
      <section className="role-panel"><h2>Mes rendez-vous</h2>{appointments.length ? <ul className="role-list">{appointments.map((appointment) => <li key={appointment.id}><div><strong>{new Date(appointment.date_time).toLocaleString("fr-FR")}</strong>{appointment.incube_message && <small style={{ display: "block", marginTop: "4px" }}>Mon message : {appointment.incube_message}</small>}</div><span className={`role-status ${appointment.status === "pending" ? "pending" : appointment.status === "cancelled" ? "cancelled" : ""}`}>{appointment.status === "cancelled" ? "Annulé" : appointment.status === "accepted" ? "Confirmé" : appointment.status === "pending" ? "En attente" : appointment.status}</span>{appointment.status !== "cancelled" && new Date(appointment.date_time) > new Date() && <button className="role-button danger" disabled={busy === appointment.id} onClick={() => void cancelAppointment(appointment)}>Annuler</button>}</li>)}</ul> : <p>Aucun rendez-vous prévu.</p>}</section>
      {mentorId && <section className="role-panel"><h2>Messages avec mon mentor</h2><div className="role-chat">{messages.map((message) => <div key={message.id} className={`role-message ${message.sender_id === userId ? "sent" : ""}`}>{message.content}</div>)}</div><form className="role-form" onSubmit={(event) => void sendMessage(event)} style={{ gridTemplateColumns: "1fr auto", marginTop: "12px" }}><input className="role-input" value={messageText} onChange={(event) => setMessageText(event.target.value)} maxLength={5000} placeholder="Votre message…"/><button className="role-button" disabled={busy === "message"}>Envoyer</button></form></section>}
    </div></div>
  </div></main>;
}

function formatSlot(dateTime: string, timeZone: string) {
  return new Date(dateTime).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}
