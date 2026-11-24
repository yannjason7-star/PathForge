import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import SessionsManagerClient, { SessionItem } from "@/components/admin/SessionsManagerClient";

export const instant = false;

export default async function AdminSessionsPage() {
  await connection();

  const [aptsRes, profilesRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, date_time, status, meet_link, agenda_notes, mentor_notes, incube_id, mentor_id")
      .order("date_time", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email"),
  ]);

  const rawAppointments = aptsRes.data || [];
  const profiles = profilesRes.data || [];

  // Assemblage relationnel sans dépendre des alias PostgREST
  const assembledSessions: SessionItem[] = rawAppointments.map((apt) => {
    const incube = profiles.find((p) => p.id === apt.incube_id) || null;
    const mentor = profiles.find((p) => p.id === apt.mentor_id) || null;

    return {
      ...apt,
      incube,
      mentor,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-1">Suivi des Sessions de Mentorat</h1>
        <p className="text-[#758396] text-sm font-medium">
          Supervisez l'intégralité des rendez-vous entre incubés et mentors, vérifiez les liens visio et intervenez en cas de blocage.
        </p>
      </div>

      <SessionsManagerClient initialSessions={assembledSessions} />
    </div>
  );
}