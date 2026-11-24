"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "../role-dashboard.css";

type Profile = { id: string; first_name: string | null; last_name: string | null; role: string; status: string };
type Project = { id: string; title: string; status: string | null };

export default function EntreprisePage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [deliverableCount, setDeliverableCount] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,status").eq("id", session.user.id).maybeSingle();
      if (profileError || profile?.role !== "entreprise" || profile.status !== "active") { router.replace("/login"); return; }
      const [projectsResult, profilesResult, deliverablesResult] = await Promise.all([
        supabase.from("projects").select("id,title,status"),
        supabase.from("profiles").select("id,first_name,last_name,role,status"),
        supabase.from("deliverables").select("id", { count: "exact", head: true }),
      ]);
      if (!active) return;
      const failed = [projectsResult, profilesResult, deliverablesResult].find((result) => result.error);
      if (failed?.error) setError(failed.error.message);
      else {
        setProjects(projectsResult.data || []);
        setProfiles(profilesResult.data || []);
        setDeliverableCount(deliverablesResult.count || 0);
      }
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [router]);

  async function signOut() { await supabase.auth.signOut(); router.replace("/login"); }
  if (!loaded) return <main className="role-loading">Chargement…</main>;

  return <main className="role-page"><div className="role-shell">
    <aside className="role-sidebar"><div className="role-brand"><span>PF</span>PathForge</div><nav><span>Vue entreprise</span><span>Projets</span><span>Incubés</span></nav><button className="role-logout" onClick={() => void signOut()}>Déconnexion</button></aside>
    <div className="role-main"><header className="role-header"><button onClick={() => void signOut()} aria-label="Déconnexion">E</button></header><div className="role-content">
      <div className="role-heading"><div><p>Espace entreprise</p><h1>Suivi de l’écosystème</h1></div></div>
      {error && <div className="role-error">{error}</div>}
      <div className="role-grid"><article className="role-card"><strong>{projects.length}</strong><span>Projets</span></article><article className="role-card"><strong>{profiles.filter((item) => item.role === "incube").length}</strong><span>Incubés</span></article><article className="role-card"><strong>{deliverableCount}</strong><span>Livrables</span></article></div>
      <section className="role-panel"><h2>Projets</h2>{projects.length ? <ul className="role-list">{projects.map((project) => <li key={project.id}><div><strong>{project.title}</strong></div><span className="role-status">{project.status || "Actif"}</span></li>)}</ul> : <p>Aucun projet enregistré.</p>}</section>
      <section className="role-panel"><h2>Incubés</h2><ul className="role-list">{profiles.filter((item) => item.role === "incube").map((profile) => <li key={profile.id}><span>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Incubé"}</span><span className={`role-status ${profile.status === "active" ? "" : "pending"}`}>{profile.status}</span></li>)}</ul></section>
    </div></div>
  </div></main>;
}
