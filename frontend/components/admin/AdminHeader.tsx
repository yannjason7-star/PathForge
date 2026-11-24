"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Search, Bell, ShieldCheck, CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type AdminNotif = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  kind?: string;
};

export default function AdminHeader({ 
  adminName, 
  adminId 
}: { 
  adminName: string; 
  adminId: string; 
}) {
  const pathname = usePathname();
  const pathSegments = pathname.split('/').filter(Boolean);
  const currentPage = pathSegments.length > 1 ? pathSegments[pathSegments.length - 1] : "Tour de contrôle";

  const [notifications, setNotifications] = useState<AdminNotif[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    if (!adminId) return;

    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", adminId)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setNotifications(data);
      });

    const channel = supabase
      .channel("admin-header-notifs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${adminId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as AdminNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAllAsRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", adminId).is("read_at", null);
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#e7edf3] flex items-center justify-between px-8 sticky top-0 z-30">
      
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-[#758396]">PathForge</span>
        <span className="text-[#e7edf3]">/</span>
        <span className="text-[#758396]">Admin</span>
        <span className="text-[#e7edf3]">/</span>
        <span className="text-[#081e2c] capitalize">{currentPage.replace(/-/g, ' ')}</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden lg:flex items-center px-3 py-1.5 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] w-64 focus-within:border-[#087f71] transition-all">
          <Search size={16} className="text-[#758396] mr-2" />
          <input 
            type="text" 
            placeholder="Rechercher sur la plateforme..." 
            className="bg-transparent border-none outline-none text-xs w-full text-[#081e2c] placeholder:text-[#758396]"
          />
        </div>

        {/* Cloche interactive */}
        <div className="relative">
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative text-[#758396] hover:text-[#081e2c] transition-colors p-2 rounded-full hover:bg-[#f4f6fb]"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-[#e7edf3] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#e7edf3] bg-[#f4f6fb] flex items-center justify-between">
                <span className="text-xs font-bold text-[#081e2c] uppercase tracking-wider">
                  Alertes Admin {unreadCount > 0 && `(${unreadCount})`}
                </span>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-[#087f71] hover:underline"
                  >
                    Tout marquer lu
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#e7edf3]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#758396]">
                    Aucune alerte pour l'instant.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-3.5 hover:bg-[#f4f6fb] transition-colors ${!notif.read_at ? 'bg-orange-50/40' : ''}`}
                    >
                      <p className="text-xs font-bold text-[#081e2c]">{notif.title}</p>
                      <p className="text-[11px] text-[#758396] mt-0.5 leading-relaxed">{notif.body}</p>
                      <span className="text-[9px] text-[#758396] font-medium mt-1 block">
                        {new Date(notif.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 border-t border-[#e7edf3] text-center bg-[#f4f6fb]">
                <Link 
                  href="/admin/notifications" 
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs font-bold text-[#087f71] hover:underline"
                >
                  Ouvrir le centre de notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-l border-[#e7edf3] pl-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-[#081e2c]">{adminName}</p>
            <p className="text-[10px] text-[#087f71] font-bold uppercase tracking-wider flex items-center gap-1 justify-end">
              <ShieldCheck size={12} /> Gestion Système
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#081e2c] flex items-center justify-center text-white font-bold text-xs shadow-sm">
            {adminName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

    </header>
  );
}