import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import FormationsClient from "@/components/incube/FormationsClient";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function FormationsPage() {
  await connection();

  // On récupère toutes les formations et les progressions de l'utilisateur
  const [formationsRes, progressionsRes] = await Promise.all([
    supabase.from("formations").select("*"),
    supabase.from("progressions").select("*").eq("user_id", currentUserId)
  ]);

  return (
    <FormationsClient 
      initialFormations={formationsRes.data || []} 
      initialProgressions={progressionsRes.data || []} 
      userId={currentUserId}
    />
  );
}