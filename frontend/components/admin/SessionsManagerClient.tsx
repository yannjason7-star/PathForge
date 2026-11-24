"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  Clock, 
  Video, 
  CheckCircle2, 
  Hourglass, 
  AlertCircle, 
  Search, 
  VideoOff, 
  Link2, 
  User, 
  MessageSquareQuote,
  X,
  FileText
} from "lucide-react";

export type SessionItem = {
  id: string;
  date_time: string;
  status: string;
  meet_link: string | null;
  agenda_notes: string | null;
  mentor_notes: string | null;
  incube_id: string;
  mentor_id: string;
  incube: { first_name: string; last_name: string; email: string } | null;
  mentor: { first_name: string; last_name: string; email: string } | null;
};

export default function SessionsManagerClient({
  initialSessions,
}: {
  initialSessions: SessionItem[];
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal d'intervention Admin (Injection lien Meet ou Forçage statut)
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [meetInput, setMeetInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // KPIs Sessions
  const stats = useMemo(() => {
    const total = sessions.length;
    const confirmed = sessions.filter((s) => s.status === "confirme").length;
    const pending = sessions.filter((s) => s.status === "en_attente").length;
    const cancelled = sessions.filter((s) => s.status === "annule").length;
    return { total, confirmed, pending, cancelled };
  }, [sessions]);

  // Filtrage
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const incubeName = `${s.incube?.first_name || ""} ${s.incube?.last_name || ""}`.toLowerCase();
      const mentorName = `${s.mentor?.first_name || ""} ${s.mentor?.last_name || ""}`.toLowerCase();
      const matchesSearch =
        incubeName.includes(searchTerm.toLowerCase()) ||
        mentorName.includes(searchTerm.toLowerCase()) ||
        (s.agenda_notes || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, statusFilter]);

  // Action Admin : Mettre à jour le lien Meet ou forcer la validation
  const handleSaveMeetLink = async () => {
    if (!selectedSession || !meetInput.trim()) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ meet_link: meetInput.trim(), status: "confirme" })
        .eq("id", selectedSession.id);

      if (error) throw error;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedSession.id ? { ...s, meet_link: meetInput.trim(), status: "confirme" } : s
        )
      );

      setSelectedSession(null);
      setMeetInput("");
      router.refresh();
      alert("Lien de session enregistré et statut confirmé avec succès !");
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Action Admin : Forcer l'annulation d'un créneau bloqué
  const handleForceCancel = async (id: string) => {
    if (!confirm("Voulez-vous annuler administrativement cette session ?")) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "annule" })
        .eq("id", id);

      if (error) throw error;

      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "annule" } : s)));
      router.refresh();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  return (
    <div className="space-y-8 pb-10">

      {/* 1. KPIs Sessions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Total Séances</p>
            <p className="text-3xl font-bold text-[#081e2c] mt-1">{stats.total}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <Calendar size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Confirmées</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.confirmed}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">En Attente Mentor</p>
            <p className="text-3xl font-bold text-[#c5a059] mt-1">{stats.pending}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#c5a059] flex items-center justify-center">
            <Hourglass size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Annulées</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{stats.cancelled}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* 2. Filtres & Recherche */}
      <div className="bg-white p-4 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center px-3 py-2 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] w-full sm:max-w-md focus-within:bg-white focus-within:border-[#087f71] transition-all">
          <Search size={16} className="text-[#758396] mr-2" />
          <input
            type="text"
            placeholder="Rechercher par incubé, mentor ou sujet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full text-[#081e2c] placeholder:text-[#758396]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {[
            { id: "all", label: "Toutes" },
            { id: "en_attente", label: "En attente" },
            { id: "confirme", label: "Confirmées" },
            { id: "annule", label: "Annulées" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                statusFilter === f.id
                  ? "bg-[#081e2c] text-white shadow-sm"
                  : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3] hover:text-[#081e2c]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Table de Suivi des Séances */}
      <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f4f6fb] text-[#758396] uppercase text-[10px] font-bold tracking-wider border-b border-[#e7edf3]">
              <tr>
                <th className="px-6 py-4">Date & Heure</th>
                <th className="px-6 py-4">Incubé</th>
                <th className="px-6 py-4">Mentor Référent</th>
                <th className="px-6 py-4">Ordre du Jour</th>
                <th className="px-6 py-4">Statut & Visio</th>
                <th className="px-6 py-4 text-right">Arbitrage Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7edf3]">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#758396]">
                    Aucune session de mentorat enregistrée.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const sDate = new Date(s.date_time);
                  const isConfirmed = s.status === "confirme";
                  const isPending = s.status === "en_attente";
                  const isCancelled = s.status === "annule";

                  return (
                    <tr key={s.id} className="hover:bg-[#f4f6fb]/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#081e2c]">
                          {sDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-[#758396] flex items-center gap-1 mt-0.5">
                          <Clock size={12} /> {sDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-bold text-[#081e2c]">{s.incube?.first_name} {s.incube?.last_name}</p>
                        <p className="text-xs text-[#758396]">{s.incube?.email}</p>
                      </td>

                      <td className="px-6 py-4">
                        <p className="font-bold text-[#081e2c]">{s.mentor?.first_name} {s.mentor?.last_name}</p>
                        <p className="text-xs text-[#087f71] font-semibold">{s.mentor?.email}</p>
                      </td>

                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-xs text-[#172538] line-clamp-2 italic">
                          {s.agenda_notes ? `« ${s.agenda_notes} »` : "Non renseigné"}
                        </p>
                        {s.mentor_notes && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#087f71] font-bold mt-1">
                            <FileText size={11} /> Compte-rendu saisi
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {isConfirmed ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Confirmé
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                              Annulé
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-[#c5a059] border border-orange-200">
                              En attente
                            </span>
                          )}

                          {s.meet_link ? (
                            <a
                              href={s.meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold text-[#087f71] hover:underline flex items-center gap-1"
                            >
                              <Video size={12} /> Lien Meet actif
                            </a>
                          ) : (
                            <span className="text-[10px] text-[#758396] flex items-center gap-1">
                              <VideoOff size={11} /> Sans visio
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedSession(s);
                              setMeetInput(s.meet_link || "");
                            }}
                            className="px-2.5 py-1.5 bg-[#f4f6fb] hover:bg-[#e7edf3] text-[#081e2c] border border-[#e7edf3] rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            title="Ajouter ou modifier le lien Meet"
                          >
                            <Link2 size={13} /> {s.meet_link ? "Modifier Meet" : "Ajouter Meet"}
                          </button>

                          {!isCancelled && (
                            <button
                              onClick={() => handleForceCancel(s.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Annulation administrative"
                            >
                              <AlertCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'arbitrage Google Meet */}
      {selectedSession && (
        <div className="fixed inset-0 bg-[#081e2c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e7edf3] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-[#e7edf3] bg-[#f4f6fb] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#081e2c] flex items-center gap-2">
                <Video size={18} className="text-[#087f71]" /> Lien de visioconférence
              </h3>
              <button onClick={() => setSelectedSession(null)} className="text-[#758396] hover:text-[#081e2c]">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-[#f4f6fb] rounded-xl text-xs space-y-1">
                <p className="font-bold text-[#081e2c]">
                  Session du {new Date(selectedSession.date_time).toLocaleDateString("fr-FR")} à {new Date(selectedSession.date_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-[#758396]">
                  Binôme : {selectedSession.incube?.first_name} (Incubé) & {selectedSession.mentor?.first_name} (Mentor)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                  URL Google Meet (ou Zoom / Teams)
                </label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={meetInput}
                  onChange={(e) => setMeetInput(e.target.value)}
                  className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                />
              </div>

              <button
                onClick={handleSaveMeetLink}
                disabled={isUpdating || !meetInput.trim()}
                className="w-full py-2.5 bg-[#087f71] hover:bg-[#066459] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isUpdating ? "Enregistrement..." : "Enregistrer et valider la session"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}