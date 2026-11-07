"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Calendar, Clock, Video, Hourglass, CheckCircle, AlertCircle, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";

type Mentor = { id: string; first_name: string; last_name: string; email: string };
type Appointment = { id: string; date_time: string; status: string; meet_link: string | null };

export default function MentoratClient({ mentor, initialAppointments, incubeId }: { mentor: Mentor | null, initialAppointments: Appointment[], incubeId: string }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentor || !date || !time) return;
    
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // Combinaison de la date et l'heure en format ISO pour la base de données
      const dateTimeString = new Date(`${date}T${time}:00`).toISOString();

      const { error } = await supabase.from('appointments').insert({
        incube_id: incubeId,
        mentor_id: mentor.id,
        date_time: dateTimeString,
        status: 'en_attente'// En attente de validation par le mentor
      });

      if (error) throw error;

      // Succès : réinitialisation et rafraîchissement
      setDate("");
      setTime("");
      router.refresh();
    } catch (error: any) {
    const detail = error?.message || error?.details || JSON.stringify(error);
      console.error("Détail réel de l'erreur RDV:", detail);
      setErrorMsg(`Erreur exacte : ${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mentor) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#e7edf3] text-center mt-6">
        <AlertCircle size={40} className="mx-auto text-[#758396] mb-4" />
        <h2 className="text-xl font-bold text-[#081e2c]">Aucun mentor assigné</h2>
        <p className="text-[#758396] mt-2 font-medium">Vous n'avez pas encore de mentor référent. Veuillez contacter l'administration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* En-tête Mentor */}
      <div className="bg-[#081e2c] rounded-2xl p-8 flex items-center gap-6 relative overflow-hidden shadow-md">
        <div className="absolute -right-10 -bottom-10 opacity-5">
          <Calendar size={200} color="white" />
        </div>
        <div className="w-16 h-16 rounded-full bg-[#f4f6fb] flex items-center justify-center text-[#081e2c] font-bold text-xl relative z-10">
          {mentor.first_name.charAt(0)}{mentor.last_name.charAt(0)}
        </div>
        <div className="relative z-10">
          <div className="inline-block px-2 py-1 bg-[#172538] text-[#c5a059] text-[10px] font-bold rounded uppercase tracking-wider mb-2">
            Mentor Référent
          </div>
          <h1 className="text-2xl font-bold text-white">{mentor.first_name} {mentor.last_name}</h1>
          <p className="text-[#758396] text-sm mt-1">{mentor.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Colonne Gauche : Formulaire de demande */}
        <div className="lg:col-span-1">
          <form onSubmit={handleRequest} className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm sticky top-28">
            <div className="flex items-center gap-2 mb-6 text-[#081e2c]">
              <CalendarPlus size={20} className="text-[#087f71]" />
              <h2 className="text-lg font-bold">Demander un RDV</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">Date souhaitée</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-3 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71] focus:ring-1 focus:ring-[#087f71] transition-all"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">Heure (Locale)</label>
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-3 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71] focus:ring-1 focus:ring-[#087f71] transition-all"
                />
              </div>
            </div>

            {errorMsg && <p className="text-xs text-red-500 font-medium mt-4">{errorMsg}</p>}

            <button 
              type="submit"
              disabled={isSubmitting || !date || !time}
              className="w-full mt-6 bg-[#087f71] hover:bg-[#066459] text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? "Envoi..." : "Envoyer la demande"}
            </button>
          </form>
        </div>

        {/* Colonne Droite : Historique des RDV */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider mb-2">Vos sessions</h2>
          
          {initialAppointments.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm text-center">
              <p className="text-[#758396] text-sm font-medium">Aucun rendez-vous programmé.</p>
            </div>
          ) : (
            initialAppointments.map((apt) => {
              const aptDate = new Date(apt.date_time);
              const isPassed = aptDate < new Date();
              const dateStr = aptDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
              const timeStr = aptDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={apt.id} className={`bg-white p-5 rounded-2xl border ${isPassed ? 'border-[#e7edf3] opacity-60' : 'border-[#e7edf3] shadow-sm'} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-[#087f71]`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#f4f6fb] flex flex-col items-center justify-center text-[#081e2c]">
                      <span className="text-[10px] font-bold uppercase">{aptDate.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{aptDate.getDate()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#081e2c] capitalize">{dateStr}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs font-semibold text-[#758396]">
                        <Clock size={14} /> {timeStr}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {apt.status === 'confirme' ? (
                      <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-full sm:w-auto">
                        <CheckCircle size={14} /> Confirmé
                      </span>
                    ) : apt.status === 'annule' ? (
                      <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg w-full sm:w-auto">
                        <AlertCircle size={14} /> Refusé
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#c5a059] bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg w-full sm:w-auto">
                        <Hourglass size={14} /> En attente
                      </span>
                    )}

                    {apt.status === 'accepted' && apt.meet_link && !isPassed && (
                      <a href={apt.meet_link} target="_blank" rel="noopener noreferrer" className="bg-[#081e2c] hover:bg-[#172538] text-white px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm">
                        <Video size={14} /> Rejoindre
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}