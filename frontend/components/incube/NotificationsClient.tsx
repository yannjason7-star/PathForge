"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  CheckCheck, 
  Clock, 
  Trash2, 
  Calendar, 
  FileText, 
  Sparkles,
  Info
} from "lucide-react";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  kind: string | null;
};

export default function NotificationsClient({
  initialNotifications,
  userId,
}: {
  initialNotifications: NotificationItem[];
  userId: string;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Écoute temps réel des alertes de Nelson ou du système
  useEffect(() => {
    const channel = supabase
      .channel("page-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as NotificationItem, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as NotificationItem;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Actions
  const handleMarkAsRead = async (id: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: now } : n))
    );
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    router.refresh();
  };

  const handleMarkAllAsRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
    router.refresh();
  };

  // Filtrage
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.read_at);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Barre d'outils */}
      <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === "all"
                ? "bg-[#081e2c] text-white shadow-sm"
                : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3]"
            }`}
          >
            Toutes ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === "unread"
                ? "bg-[#087f71] text-white shadow-sm"
                : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3]"
            }`}
          >
            Non lues {unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-red-400"></span>}
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs font-bold text-[#087f71] hover:text-[#066459] flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck size={16} /> Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Liste des alertes */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#e7edf3] text-center text-[#758396] shadow-sm">
          <Bell size={36} className="mx-auto mb-2 opacity-30 text-[#081e2c]" />
          <p className="text-sm font-semibold">Aucune notification dans cette vue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isUnread = !item.read_at;

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                  isUnread
                    ? "bg-white border-[#087f71]/40 shadow-sm"
                    : "bg-white/70 border-[#e7edf3]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isUnread ? "bg-[#e6f2f1] text-[#087f71]" : "bg-[#f4f6fb] text-[#758396]"
                  }`}>
                    {item.kind === 'appointment' ? <Calendar size={18} /> : 
                     item.kind === 'deliverable' ? <FileText size={18} /> : 
                     <Sparkles size={18} />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-[#081e2c]">{item.title}</h3>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      )}
                    </div>
                    <p className="text-xs text-[#172538] leading-relaxed">{item.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[#758396] font-medium">
                      <Clock size={12} />
                      {new Date(item.created_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      className="p-2 text-[#758396] hover:text-[#087f71] hover:bg-[#e6f2f1] rounded-lg transition-colors"
                      title="Marquer comme lu"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-[#758396] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer l'alerte"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}