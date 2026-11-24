"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  Send, 
  CheckCheck, 
  Trash2, 
  Clock, 
  Megaphone, 
  Users, 
  ShieldCheck, 
  Sparkles,
  Radio
} from "lucide-react";

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  kind: string | null;
};

export type TargetProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
};

export default function AdminNotificationsClient({
  initialNotifications,
  profilesList,
  adminId,
}: {
  initialNotifications: AdminNotification[];
  profilesList: TargetProfile[];
  adminId: string;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotification[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState<"inbox" | "broadcast">("inbox");

  // Formulaire d'Alerte Broadcast
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "incubes" | "mentors" | "single">("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Temps réel sur les notifications admin
  useEffect(() => {
    const channel = supabase
      .channel("admin-notif-hub")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${adminId}` },
        (payload) => setNotifications((prev) => [payload.new as AdminNotification, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${adminId}` },
        (payload) => {
          const updated = payload.new as AdminNotification;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", adminId).is("read_at", null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
    router.refresh();
  };

  // ENVOI D'UN BROADCAST (ALERTE SYSTÈME GLOBALE)
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;

    setIsBroadcasting(true);

    try {
      let targetUserIds: string[] = [];

      if (broadcastTarget === "all") {
        targetUserIds = profilesList.map((p) => p.id);
      } else if (broadcastTarget === "incubes") {
        targetUserIds = profilesList.filter((p) => p.role === "incube").map((p) => p.id);
      } else if (broadcastTarget === "mentors") {
        targetUserIds = profilesList.filter((p) => p.role === "mentor").map((p) => p.id);
      } else if (broadcastTarget === "single" && selectedUserId) {
        targetUserIds = [selectedUserId];
      }

      if (targetUserIds.length === 0) {
        alert("Aucun destinataire trouvé.");
        setIsBroadcasting(false);
        return;
      }

      const rowsToInsert = targetUserIds.map((uid) => ({
        user_id: uid,
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        kind: "broadcast",
        read_at: null,
      }));

      const { error } = await supabase.from("notifications").insert(rowsToInsert);
      if (error) throw error;

      alert(`Alerte diffusée avec succès à ${targetUserIds.length} utilisateur(s) !`);
      setBroadcastTitle("");
      setBroadcastBody("");
      setActiveTab("inbox");
      router.refresh();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      
      {/* Navigation des Onglets */}
      <div className="flex items-center gap-2 border-b border-[#e7edf3] pb-4">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "inbox"
              ? "bg-[#081e2c] text-white shadow-sm"
              : "bg-white border border-[#e7edf3] text-[#758396] hover:bg-[#f4f6fb]"
          }`}
        >
          <Bell size={16} /> Alertes Reçues {unreadCount > 0 && `(${unreadCount})`}
        </button>

        <button
          onClick={() => setActiveTab("broadcast")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "broadcast"
              ? "bg-[#087f71] text-white shadow-sm"
              : "bg-white border border-[#e7edf3] text-[#758396] hover:bg-[#f4f6fb]"
          }`}
        >
          <Radio size={16} /> Diffuser une Alerte (Broadcast)
        </button>
      </div>

      {/* ONGLET 1 : BOÎTE DE RÉCEPTION ADMIN */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#758396]">
              Flux d'événements plateforme
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-bold text-[#087f71] hover:underline flex items-center gap-1"
              >
                <CheckCheck size={14} /> Tout marquer comme lu
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-[#e7edf3] text-center text-[#758396] shadow-sm">
              <Bell size={36} className="mx-auto mb-2 opacity-30 text-[#081e2c]" />
              <p className="text-sm font-semibold">Aucune notification reçue pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => {
                const isUnread = !item.read_at;

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                      isUnread
                        ? "bg-white border-[#087f71]/50 shadow-sm"
                        : "bg-white/70 border-[#e7edf3]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isUnread ? "bg-[#e6f2f1] text-[#087f71]" : "bg-[#f4f6fb] text-[#758396]"
                      }`}>
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-[#081e2c]">{item.title}</h3>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                        </div>
                        <p className="text-xs text-[#172538] leading-relaxed">{item.body}</p>
                        <span className="text-[10px] text-[#758396] font-medium mt-2 block">
                          {new Date(item.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-[#758396] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 : ÉMETTEUR DE BROADCAST (PUISSANCE ADMIN) */}
      {activeTab === "broadcast" && (
        <form onSubmit={handleSendBroadcast} className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-[#081e2c]">
            <Megaphone size={20} className="text-[#087f71]" />
            <h2 className="text-lg font-bold">Diffuser une annonce officielle</h2>
          </div>

          <p className="text-xs text-[#758396]">
            Ce message apparaîtra instantanément dans le centre de notifications et la cloche des utilisateurs ciblés.
          </p>

          {/* Cible */}
          <div>
            <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
              Audience cible
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "all", label: "Tous (Plateforme)" },
                { id: "incubes", label: "Incubés seuls" },
                { id: "mentors", label: "Mentors seuls" },
                { id: "single", label: "Utilisateur précis" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBroadcastTarget(t.id as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    broadcastTarget === t.id
                      ? "border-[#087f71] bg-[#e6f2f1] text-[#087f71]"
                      : "border-[#e7edf3] bg-[#f4f6fb] text-[#758396]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sélection unitaire si single */}
          {broadcastTarget === "single" && (
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                Sélectionner l'utilisateur
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-xs text-[#081e2c] focus:outline-none focus:border-[#087f71]"
              >
                <option value="">Choisir un compte...</option>
                {profilesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.role}) - {p.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Titre */}
          <div>
            <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
              Titre de l'alerte
            </label>
            <input
              type="text"
              placeholder="Ex: Atelier collectif Pitch Deck ce vendredi à 14h"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              required
              className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
            />
          </div>

          {/* Corps du message */}
          <div>
            <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
              Message détaillé
            </label>
            <textarea
              rows={4}
              placeholder="Rédigez les consignes ou les détails de l'annonce..."
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              required
              className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl p-3 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
            />
          </div>

          <button
            type="submit"
            disabled={isBroadcasting || !broadcastTitle || !broadcastBody}
            className="w-full py-3 bg-[#087f71] hover:bg-[#066459] text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={15} />
            {isBroadcasting ? "Diffusion en cours..." : "Diffuser la notification immédiatement"}
          </button>
        </form>
      )}

    </div>
  );
}