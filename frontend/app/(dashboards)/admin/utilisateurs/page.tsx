import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import UserTableClient from "@/components/admin/UserTableClient";

export const instant = false;

export default async function AdminUsersPage() {
  await connection();

  // Récupération de tous les profils classés par date de création (les plus récents en premier)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Gestion des Utilisateurs & KYC</h1>
        <p className="text-[#758396] text-sm font-medium">
          Contrôlez les accès, examinez les nouveaux inscrits et activez les comptes sur la plateforme.
        </p>
      </div>

      <UserTableClient initialProfiles={profiles || []} />
    </div>
  );
}