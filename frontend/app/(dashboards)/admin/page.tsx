"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "../role-dashboard.css";

type Profile = { id: string; first_name: string | null; last_name: string | null; role: string; status: string };
type Project = { id: string; title: string; status: string | null };
type AuditLog = {
  id: string;
  occurred_at: string;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
};

export default function AdminPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,status").eq("id", session.user.id).maybeSingle();
      if (profileError || profile?.role !== "admin" || profile.status !== "active") { router.replace("/login"); return; }
      const [profilesResult, projectsResult, auditResult] = await Promise.all([
        supabase.from("profiles").select("id,first_name,last_name,role,status").order("role"),
        supabase.from("projects").select("id,title,status"),
        supabase.from("audit_recent_activity").select("id,occurred_at,actor_id,table_name,record_id,action").order("occurred_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      if (profilesResult.error || projectsResult.error || auditResult.error) setError(profilesResult.error?.message || projectsResult.error?.message || auditResult.error?.message || "Erreur de chargement.");
      else { setProfiles(profilesResult.data || []); setProjects(projectsResult.data || []); setAuditLogs(auditResult.data || []); }
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [router]);

  async function updateProfile(profile: Profile, role: string, status: string) {
    setBusy(profile.id); setError(""); setNotice("");
    const { error: updateError } = await supabase.rpc("admin_update_profile", {
      p_profile_id: profile.id, p_role: role, p_status: status,
    });
    if (updateError) setError(updateError.message);
    else { setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, role, status } : item)); setNotice("Profil mis à jour."); }
    setBusy("");
  }

  async function signOut() { await supabase.auth.signOut(); router.replace("/login"); }
  if (!loaded) return <main className="role-loading">Chargement…</main>;

  return <main className="role-page"><div className="role-shell">
    <aside className="role-sidebar"><div className="role-brand"><span>PF</span>PathForge</div><nav><span>Utilisateurs</span><span>Projets</span><span>Paramètres</span></nav><button className="role-logout" onClick={() => void signOut()}>Déconnexion</button></aside>
    <div className="role-main"><header className="role-header"><button onClick={() => void signOut()} aria-label="Déconnexion">A</button></header><div className="role-content">
      <div className="role-heading"><div><p>Espace administration</p><h1>Gestion de la plateforme</h1></div></div>
      {error && <div className="role-error">{error}</div>} {notice && <div className="role-notice">{notice}</div>}
      <div className="role-grid"><article className="role-card"><strong>{profiles.length}</strong><span>Utilisateurs</span></article><article className="role-card"><strong>{profiles.filter((item) => item.role === "incube").length}</strong><span>Incubés</span></article><article className="role-card"><strong>{projects.length}</strong><span>Projets</span></article></div>
      <section className="role-panel"><h2>Utilisateurs</h2><table className="role-table"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>Statut</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}>
        <td>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Sans nom"}</td>
        <td><select className="role-select" value={profile.role} disabled={busy === profile.id} onChange={(event) => void updateProfile(profile, event.target.value, profile.status)}><option value="incube">Incubé</option><option value="mentor">Mentor</option><option value="entreprise">Entreprise</option><option value="admin">Administrateur</option></select></td>
        <td><select className="role-select" value={profile.status} disabled={busy === profile.id} onChange={(event) => void updateProfile(profile, profile.role, event.target.value)}><option value="active">Actif</option><option value="pending">En attente</option><option value="inactive">Inactif</option></select></td>
      </tr>)}</tbody></table></section>
      <section className="role-panel"><h2>Projets</h2>{projects.length ? <ul className="role-list">{projects.map((project) => <li key={project.id}><div><strong>{project.title}</strong></div><span className="role-status">{project.status || "Actif"}</span></li>)}</ul> : <p>Aucun projet.</p>}</section>
      <section className="role-panel"><h2>Journal d’audit</h2>{auditLogs.length ? <table className="role-table"><thead><tr><th>Date</th><th>Action</th><th>Table</th><th>Enregistrement</th></tr></thead><tbody>{auditLogs.map((log) => <tr key={log.id}><td>{new Date(log.occurred_at).toLocaleString("fr-FR")}</td><td>{log.action}</td><td>{log.table_name}</td><td>{log.record_id || "—"}</td></tr>)}</tbody></table> : <p>Aucune activité enregistrée.</p>}</section>
    </div></div>
  </div></main>;
}