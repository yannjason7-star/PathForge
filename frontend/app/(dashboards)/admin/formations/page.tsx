import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import FormationManagerClient, { Formation } from "@/components/admin/FormationManagerClient";

export const instant = false;

export default async function AdminFormationsPage() {
  await connection();

  // Récupération des cours avec le champ description ajouté
  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, description, type, file_url, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Catalogue des Formations</h1>
        <p className="text-[#758396] text-sm font-medium">
          Créez, publiez et gérez les ressources pédagogiques (vidéos, supports PDF et quiz) mises à disposition des incubés.
        </p>
      </div>

      <FormationManagerClient initialFormations={(formations as Formation[]) || []} />
    </div>
  );
}