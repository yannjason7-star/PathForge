import IncubeSidebar from "@/components/incube/IncubeSidebar";
import IncubeHeader from "@/components/incube/IncubeHeader";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { connection } from "next/server";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function IncubeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  // On récupère le profil (pour la semaine) et le projet (pour l'upload)
  const { data: profile } = await supabase.from("profiles").select("status, first_name, created_at").eq("id", currentUserId).single();
  const { data: project } = await supabase.from("projects").select("id").eq("incube_id", currentUserId).single();

  if (profile?.status === "pending") {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#e7edf3] max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#e6f2f1] text-[#087f71] rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-xl font-bold text-[#081e2c] mb-2">Compte en cours d'analyse</h1>
          <p className="text-sm text-[#758396]">Votre profil est actuellement en cours de vérification. Vous serez notifié dès son activation.</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.first_name || "Incubé";
  const createdAt = profile?.created_at || new Date().toISOString();
  const projectId = project?.id || null;

  return (
    <div className="flex h-screen bg-[#f4f6fb] font-sans">
      <div className="hidden md:block w-64 flex-shrink-0">
        <IncubeSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <IncubeHeader firstName={firstName} createdAt={createdAt} projectId={projectId} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}