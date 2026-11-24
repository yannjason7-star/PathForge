import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import NotificationsClient, { NotificationItem } from "@/components/incube/NotificationsClient";

export const instant = false;
const currentUserId = "7bf38fa8-6f54-4d2e-9d2f-12553280e8c8";

export default async function IncubeNotificationsPage() {
  await connection();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, read_at, created_at, kind")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-1">Centre de Notifications</h1>
        <p className="text-[#758396] text-sm font-medium">
          Retrouvez l'historique complet des alertes de votre mentor, des validations de livrables et des sessions.
        </p>
      </div>

      <NotificationsClient 
        initialNotifications={(notifications as NotificationItem[]) || []} 
        userId={currentUserId} 
      />
    </div>
  );
}