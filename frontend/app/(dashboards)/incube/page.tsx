import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import { Target, Calendar, CheckCircle, BookOpen, Clock, ChevronRight, Video } from "lucide-react";
import ChecklistWidget from "@/components/incube/ChecklistWidget";
import Link from "next/link";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function IncubeDashboard() {
  await connection();
  const now = new Date().toISOString();

  const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", currentUserId).single();
  const { data: project } = await supabase.from("projects").select("id, title, status").eq("incube_id", currentUserId).single();
  const { data: appointments } = await supabase.from("appointments").select("*").eq("incube_id", currentUserId).gte("date_time", now).order("date_time", { ascending: true }).limit(1);
  const { data: tasks } = await supabase.from("tasks").select("*").eq("incube_id", currentUserId).order("created_at", { ascending: true });
  
  const { count: totalFormations } = await supabase.from("formations").select("*", { count: 'exact', head: true });
  const { count: completedProgressions } = await supabase.from("progressions").select("*", { count: 'exact', head: true }).eq("user_id", currentUserId).eq("is_completed", true);

  let pendingDeliverable = null;
  if (project?.id) {
    const { data: deliverables } = await supabase.from("deliverables").select("*").eq("project_id", project.id).eq("status", "en attente").limit(1);
    if (deliverables && deliverables.length > 0) pendingDeliverable = deliverables[0];
  }

  const firstName = profile?.first_name || "Incubé";
  const projectTitle = project?.title || "En attente de définition";
  const projectStatus = project?.status || "Non démarré";
  
  const nextRdv = appointments && appointments.length > 0 ? appointments[0] : null;
  const progressPercentage = totalFormations && totalFormations > 0 ? Math.round(((completedProgressions || 0) / totalFormations) * 100) : 0;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Bonjour {firstName} 👋</h1>
        <p className="text-[#758396] text-sm font-medium">Voici un résumé de votre avancement et vos prochaines étapes clés.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center mb-4"><Target size={20} /></div>
            <h2 className="text-xs font-bold text-[#758396] uppercase tracking-wider mb-1">Projet & Formations</h2>
            <p className="text-lg font-bold text-[#081e2c] truncate mb-1">{projectTitle}</p>
            <div className="inline-block px-2 py-1 bg-[#e7edf3] text-[#172538] text-[10px] font-bold rounded uppercase tracking-wider mb-4">{projectStatus}</div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium text-[#758396] mb-2">
              <span>Progression du parcours</span><span className="text-[#081e2c] font-bold">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-[#f4f6fb] rounded-full h-1.5">
              <div className="bg-[#c5a059] h-1.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center mb-4"><CheckCircle size={20} /></div>
            <h2 className="text-xs font-bold text-[#758396] uppercase tracking-wider mb-1">Action Requise</h2>
            <p className="text-lg font-bold text-[#081e2c] mb-2">{pendingDeliverable ? "Livrable en attente" : "Vous êtes à jour"}</p>
            <p className="text-sm font-medium text-[#758396]">{pendingDeliverable ? "Un document nécessite votre attention." : "Tous vos jalons sont validés."}</p>
          </div>
          <Link href="/incube/projet" className="w-full mt-4 bg-[#f4f6fb] hover:bg-[#e7edf3] text-[#081e2c] text-sm font-semibold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2">
            Gérer mes documents <ChevronRight size={16} />
          </Link>
        </div>

        <div className="bg-[#081e2c] p-6 rounded-2xl border border-[#172538] shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none"><Calendar size={120} color="white" /></div>
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#172538] text-white flex items-center justify-center mb-4 relative z-10"><Clock size={20} /></div>
            <h2 className="text-xs font-bold text-[#758396] uppercase tracking-wider mb-1 relative z-10">Prochain RDV Mentor</h2>
            <p className="text-lg font-bold text-white relative z-10 capitalize">
              {nextRdv ? new Date(nextRdv.date_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : "Aucun rendez-vous"}
            </p>
          </div>
          {nextRdv && (
            <a href={nextRdv.meet_link || "#"} target={nextRdv.meet_link ? "_blank" : "_self"} className={`w-full mt-4 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors relative z-10 shadow-sm flex items-center justify-center gap-2 ${nextRdv.meet_link ? 'bg-[#087f71] hover:bg-[#066459]' : 'bg-[#172538] cursor-not-allowed opacity-70'}`}>
              {nextRdv.meet_link ? "Rejoindre la session" : "Lien Meet en attente"}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChecklistWidget initialTasks={tasks || []} />
        <Link href="/incube/formations" className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col justify-between group hover:border-[#087f71] transition-colors cursor-pointer">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <BookOpen size={20} className="text-[#c5a059]" />
              <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider">Reprendre la formation</h2>
            </div>
            <div className="aspect-video w-full bg-[#081e2c] rounded-xl mb-4 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[#172538] opacity-50 group-hover:opacity-40 transition-opacity"></div>
              <div className="w-12 h-12 rounded-full bg-[#087f71] flex items-center justify-center relative z-10 shadow-lg group-hover:scale-110 transition-transform">
                <Video size={20} className="text-white ml-1" />
              </div>
            </div>
            <p className="text-lg font-bold text-[#081e2c] group-hover:text-[#087f71] transition-colors">Accéder aux modules vidéos</p>
          </div>
        </Link>
      </div>
    </div>
  );
}