import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import MatchingClient, { 
  ProjectWithRelations, 
  MentorOption, 
  IncubeInfo 
} from "@/components/admin/MatchingClient";

export const instant = false;

export default async function AdminMatchingPage() {
  await connection();

  // 1. Récupération parallèle des données (Projets, Mentors et Incubés)
  const [projectsRes, mentorsRes, incubesRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, status, incube_id, mentor_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "mentor")
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "incube"),
  ]);

  const rawProjects = projectsRes.data || [];
  const mentors: MentorOption[] = mentorsRes.data || [];
  const incubes: IncubeInfo[] = incubesRes.data || [];

  // 2. Assemblage en mémoire des relations (Projet <-> Incubé <-> Mentor)
  const assembledProjects: ProjectWithRelations[] = rawProjects.map((p) => {
    const incube = incubes.find((i) => i.id === p.incube_id) || null;
    const mentor = mentors.find((m) => m.id === p.mentor_id) || null;
    return {
      ...p,
      incube,
      mentor,
    };
  });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Matching Incubation</h1>
        <p className="text-[#758396] text-sm font-medium">
          Associez chaque projet de start-up à son Mentor référent pour activer le suivi et l'évaluation des livrables.
        </p>
      </div>

      <MatchingClient 
        initialProjects={assembledProjects} 
        mentorsList={mentors} 
      />
    </div>
  );
}