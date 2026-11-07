import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import ProjectClient from "@/components/incube/ProjectClient";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function ProjectPage() {
  await connection();

  // 1. Récupération du projet de l'incubé
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("incube_id", currentUserId)
    .single();

  let deliverables = [];

  // 2. Si un projet existe, on récupère son historique de livrables
  if (project?.id) {
    const { data } = await supabase
      .from("deliverables")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
      
    if (data) deliverables = data;
  }

  return (
    <ProjectClient 
      project={project} 
      initialDeliverables={deliverables} 
    />
  );
}