import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import MentoratClient, { Appointment, Mentor, AvailabilityRow } from "@/components/incube/MentoratClient";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function MentoratPage() {
  await connection();

  // 1. Identification du projet et du mentor assigné
  const { data: project } = await supabase
    .from("projects")
    .select("mentor_id")
    .eq("incube_id", currentUserId)
    .single();

  let mentor: Mentor | null = null;
  let appointments: Appointment[] = [];
  let allMentorAppointments: Appointment[] = [];
  let availabilities: AvailabilityRow[] = [];

  if (project?.mentor_id) {
    const [mentorRes, myAptsRes, allAptsRes, availRes] = await Promise.all([
      // Profil mentor
      supabase.from("profiles").select("id, first_name, last_name, email").eq("id", project.mentor_id).single(),
      // Mes RDV à moi
      supabase.from("appointments").select("*").eq("incube_id", currentUserId).order("date_time", { ascending: false }),
      // Tous les RDV de ce mentor pour calculer les créneaux déjà pris par d'autres
      supabase.from("appointments").select("id, date_time, status, incube_id").eq("mentor_id", project.mentor_id).neq("status", "annule"),
      // Plages configurées par Nelson (table availabilities)
      supabase.from("mentor_availability").select("*").eq("mentor_id", project.mentor_id).eq("is_active", true)
    ]);

    if (mentorRes.data) mentor = mentorRes.data as Mentor;
    if (myAptsRes.data) appointments = myAptsRes.data as Appointment[];
    if (allAptsRes.data) allMentorAppointments = allAptsRes.data as Appointment[];
    if (availRes.data) availabilities = availRes.data as AvailabilityRow[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-1">Mentorat & Suivi</h1>
        <p className="text-[#758396] text-sm font-medium">
          Réservez un créneau selon les disponibilités réelles de votre mentor et suivez vos comptes-rendus de séance.
        </p>
      </div>

      <MentoratClient 
        mentor={mentor} 
        initialAppointments={appointments} 
        allMentorAppointments={allMentorAppointments}
        initialAvailabilities={availabilities}
        incubeId={currentUserId} 
      />
    </div>
  );
}