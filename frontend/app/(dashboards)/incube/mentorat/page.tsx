import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import MentoratClient from "@/components/incube/MentoratClient";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function MentoratPage() {
  await connection();

  // 1. Trouver le projet de l'incubé pour identifier son mentor
  const { data: project } = await supabase
    .from("projects")
    .select("mentor_id")
    .eq("incube_id", currentUserId)
    .single();

  let mentor = null;
  let appointments = [];

  // 2. Si l'incubé a un mentor assigné, on récupère le profil du mentor et l'historique des RDV
  if (project?.mentor_id) {
    const { data: mentorData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", project.mentor_id)
      .single();
      
    if (mentorData) mentor = mentorData;

    const { data: aptData } = await supabase
      .from("appointments")
      .select("*")
      .eq("incube_id", currentUserId)
      .order("date_time", { ascending: false });

    if (aptData) appointments = aptData;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Mentorat & Suivi</h1>
        <p className="text-[#758396] text-sm font-medium">Planifiez vos sessions d'accompagnement et consultez votre historique.</p>
      </div>

      <MentoratClient 
        mentor={mentor} 
        initialAppointments={appointments} 
        incubeId={currentUserId}
      />
    </div>
  );
}