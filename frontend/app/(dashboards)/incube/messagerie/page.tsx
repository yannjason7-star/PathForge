import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import MessagerieClient from "@/components/incube/MessagerieClient";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function MessageriePage() {
  await connection();

  // 1. Identifier le mentor assigné à l'incubé via son projet
  const { data: project } = await supabase
    .from("projects")
    .select("mentor_id")
    .eq("incube_id", currentUserId)
    .single();

  let mentor = null;
  let messages = [];

  if (project?.mentor_id) {
    // 2. Récupérer le profil du mentor
    const { data: mentorData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", project.mentor_id)
      .single();
      
    if (mentorData) mentor = mentorData;

    // 3. Récupérer l'historique complet de la conversation
    const { data: msgData } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${project.mentor_id}),and(sender_id.eq.${project.mentor_id},receiver_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true }); // On trie du plus ancien au plus récent

    if (msgData) messages = msgData;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Messagerie</h1>
        <p className="text-[#758396] text-sm font-medium">Échangez en direct avec votre mentor référent.</p>
      </div>

      <MessagerieClient 
        mentor={mentor} 
        initialMessages={messages} 
        incubeId={currentUserId}
      />
    </div>
  );
}