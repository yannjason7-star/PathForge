import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import AdminNotificationsClient, { 
  AdminNotification, 
  TargetProfile 
} from "@/components/admin/AdminNotificationsClient";

export const instant = false;
const currentAdminId = "a0000000-0000-0000-0000-000000000000";

export default async function AdminNotificationsPage() {
  await connection();

  const [notifsRes, profilesRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, title, body, read_at, created_at, kind")
      .eq("user_id", currentAdminId)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email, role")
      .neq("id", currentAdminId),
  ]);

  const notifications = (notifsRes.data as AdminNotification[]) || [];
  const profiles = (profilesRes.data as TargetProfile[]) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-1">Centre d'Alertes & Diffusion</h1>
        <p className="text-[#758396] text-sm font-medium">
          Consultez les alertes de supervision et diffusez des annonces officielles ciblées sur l'ensemble de la plateforme.
        </p>
      </div>

      <AdminNotificationsClient 
        initialNotifications={notifications} 
        profilesList={profiles} 
        adminId={currentAdminId} 
      />
    </div>
  );
}