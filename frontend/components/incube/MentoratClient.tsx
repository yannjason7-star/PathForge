"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  Clock, 
  Video, 
  Hourglass, 
  CheckCircle2, 
  AlertCircle, 
  CalendarPlus, 
  Sparkles, 
  Lock, 
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Ban,
  Check,
  SlidersHorizontal
} from "lucide-react";

export type Mentor = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type Appointment = {
  id: string;
  date_time: string;
  status: string;
  meet_link: string | null;
  agenda_notes: string | null;
  mentor_notes: string | null;
  incube_id: string;
};

export type AvailabilityRow = {
  id: string;
  mentor_id: string;
  day_of_week: number; // 1 = Lundi, 4 = Jeudi ...
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export default function MentoratClient({
  mentor,
  initialAppointments,
  allMentorAppointments,
  initialAvailabilities,
  incubeId,
}: {
  mentor: Mentor | null;
  initialAppointments: Appointment[];
  allMentorAppointments: Appointment[];
  initialAvailabilities: AvailabilityRow[];
  incubeId: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>(allMentorAppointments);
  const [availabilities, setAvailabilities] = useState<AvailabilityRow[]>(initialAvailabilities);

  // Mode de réservation : "calendar" (créneaux Nelson) ou "custom" (proposer librement)
  const [bookingMode, setBookingMode] = useState<"calendar" | "custom">("calendar");

  // Navigation par semaine (0 = semaine actuelle, 1 = semaine prochaine, etc.)
  const [weekOffset, setWeekOffset] = useState(0);

  // Données de formulaire
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [agendaNotes, setAgendaNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 1. ÉCOUTE TEMPS RÉEL (RDV et Créneaux de Nelson)
  useEffect(() => {
    if (!mentor) return;

    const channel = supabase
      .channel("mentorat-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `mentor_id=eq.${mentor.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newApt = payload.new as Appointment;
            setAllAppointments((prev) => [...prev, newApt]);
            if (newApt.incube_id === incubeId) setAppointments((prev) => [newApt, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Appointment;
            setAllAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
            setAppointments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentor_availability", filter: `mentor_id=eq.${mentor.id}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mentor, incubeId, router]);

  // 2. RÈGLE : RDV ACTIF À VENIR (Bloque la réservation si actif)
  const activeUpcomingAppointment = useMemo(() => {
    const now = new Date();
    return appointments.find((apt) => !["annule", "cancelled", "rejected"].includes(apt.status) && new Date(apt.date_time) >= now);
  }, [appointments]);

  // 3. CALCUL DES JOURS DE LA SEMAINE VISIBLE
  const currentWeekDays = useMemo(() => {
    const today = new Date();
    // Calcule le lundi de la semaine sélectionnée
    const dayOfWeek = today.getDay(); // 0 = Dimanche
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + weekOffset * 7);

    const days = [];
    for (let i = 0; i < 5; i++) { // Du lundi au vendredi
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekOffset]);

  // 4. GÉNÉRATION DES BLOCS DE CRÉNEAUX POUR CHAQUE JOUR
  const getDaySlots = (dayDate: Date) => {
    const jsDay = dayDate.getDay(); // 1 = Lundi, 4 = Jeudi, etc.
    const matchingAvails = availabilities.filter((av) => av.is_active && av.day_of_week === jsDay);

    const slots: { time: string; iso: string; isBooked: boolean; isPast: boolean }[] = [];
    const now = new Date();

    matchingAvails.forEach((av) => {
      const startH = parseInt(av.start_time.split(":")[0], 10);
      const endH = parseInt(av.end_time.split(":")[0], 10);

      for (let h = startH; h < endH; h++) {
        const slotDate = new Date(dayDate);
        slotDate.setHours(h, 0, 0, 0);

        const iso = slotDate.toISOString();
        const timeFormatted = `${h.toString().padStart(2, "0")}:00`;
        const isPast = slotDate <= now;

        // Vérifier si un RDV existe déjà sur cette heure
        const isBooked = allAppointments.some((a) => {
          if (a.status === "annule") return false;
          return Math.abs(new Date(a.date_time).getTime() - slotDate.getTime()) < 50 * 60 * 1000;
        });

        slots.push({ time: timeFormatted, iso, isBooked, isPast });
      }
    });

    return slots;
  };

  // 5. ENVOI DU RDV (Créneau ou Sur-mesure)
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentor || !agendaNotes.trim()) return;

    let finalIso = selectedIso;

    if (bookingMode === "custom") {
      if (!customDate || !customTime) {
        setErrorMsg("Veuillez sélectionner une date et une heure valides.");
        return;
      }
      finalIso = new Date(`${customDate}T${customTime}:00`).toISOString();
    }

    if (!finalIso) {
      setErrorMsg("Veuillez choisir un horaire.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const { data: newApt, error } = await supabase
        .from("appointments")
        .insert({
          incube_id: incubeId,
          mentor_id: mentor.id,
          date_time: finalIso,
          status: "en_attente",
          agenda_notes: agendaNotes.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      if (newApt) {
        setAppointments([newApt, ...appointments]);
        setAllAppointments([...allAppointments, newApt]);
      }

      setSelectedIso(null);
      setSelectedLabel("");
      setCustomDate("");
      setCustomTime("");
      setAgendaNotes("");
      router.refresh();
      alert("Demande de session transmise à Nelson !");
    } catch (err: any) {
      setErrorMsg(`Erreur : ${err?.message || "Action impossible"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. ANNULATION PAR L'INCUBÉ
  const handleCancelAppointment = async (aptId: string) => {
    if (!confirm("Voulez-vous vraiment annuler cette réservation ?")) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", aptId);

      if (error) throw error;

      setAppointments((prev) => prev.map((a) => (a.id === aptId ? { ...a, status: "cancelled" } : a)));
      setAllAppointments((prev) => prev.map((a) => (a.id === aptId ? { ...a, status: "cancelled" } : a)));
      router.refresh();
    } catch (err: any) {
      alert("Erreur annulation : " + err?.message);
    }
  };

  if (!mentor) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#e7edf3] text-center mt-6">
        <AlertCircle size={40} className="mx-auto text-[#758396] mb-3" />
        <h2 className="text-xl font-bold text-[#081e2c]">Aucun mentor assigné</h2>
        <p className="text-[#758396] text-sm mt-1">L'administration procèdera au matching de votre projet sous peu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">

      {/* Profil Mentor */}
      <div className="bg-[#081e2c] rounded-2xl p-6 md:p-8 flex items-center justify-between relative overflow-hidden shadow-md">
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-full bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center font-bold text-xl shadow-inner">
            {mentor.first_name?.[0]}{mentor.last_name?.[0] || ""}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#172538] text-[#c5a059] text-[10px] font-bold rounded-full uppercase tracking-wider mb-2">
              <Sparkles size={12} /> Accompagnateur Référent
            </div>
            <h1 className="text-2xl font-bold text-white">{mentor.first_name} {mentor.last_name}</h1>
            <p className="text-[#758396] text-xs mt-0.5">{mentor.email}</p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end relative z-10 text-right">
          <span className="text-xs text-[#758396]">Disponibilités synchronisées</span>
          <span className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {availabilities.length} plage(s) active(s)
          </span>
        </div>
      </div>

      {/* ZONE PRINCIPALE : Calendrier à gauche (2 cols) | Historique à droite (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* COLONNE GAUCHE (2 colonnes) : Le Calendrier interactif */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm space-y-6">
          
          {/* CAS 1 : VERROUILLÉ SI RDV ACTIF */}
          {activeUpcomingAppointment ? (
            <div className="p-6 bg-[#f4f6fb] rounded-2xl border border-[#e7edf3] space-y-4">
              <div className="flex items-center gap-3 text-[#c5a059]">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#081e2c]">Réservation actuellement verrouillée</h3>
                  <p className="text-xs text-[#758396]">Une seule session peut être programmée à la fois.</p>
                </div>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#e7edf3] text-xs space-y-2">
                <span className="text-[10px] font-bold uppercase text-[#758396]">Votre session active :</span>
                <p className="text-sm font-bold text-[#087f71] flex items-center gap-1.5">
                  <CalendarCheck size={16} />
                  {new Date(activeUpcomingAppointment.date_time).toLocaleString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {activeUpcomingAppointment.agenda_notes && (
                  <p className="text-[#172538] pt-1 italic">« {activeUpcomingAppointment.agenda_notes} »</p>
                )}
              </div>

              <button
                onClick={() => handleCancelAppointment(activeUpcomingAppointment.id)}
                className="w-full py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
              >
                Annuler cette réservation pour libérer le calendrier
              </button>
            </div>
          ) : (
            /* CAS 2 : CALENDRIER PAR BLOCS & SUR-MESURE */
            <div className="space-y-6">
              
              {/* Onglets de Mode */}
              <div className="flex items-center justify-between border-b border-[#e7edf3] pb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setBookingMode("calendar"); setSelectedIso(null); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      bookingMode === "calendar"
                        ? "bg-[#081e2c] text-white shadow-sm"
                        : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3]"
                    }`}
                  >
                    Créneaux ouverts de Nelson
                  </button>
                  <button
                    onClick={() => { setBookingMode("custom"); setSelectedIso(null); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      bookingMode === "custom"
                        ? "bg-[#087f71] text-white shadow-sm"
                        : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3]"
                    }`}
                  >
                    <SlidersHorizontal size={14} /> Proposer un autre horaire
                  </button>
                </div>
              </div>

              {/* VUE A : LE CALENDRIER HEBDOMADAIRE PAR BLOCS */}
              {bookingMode === "calendar" && (
                <div className="space-y-4">
                  
                  {/* Navigation par dates exactes */}
                  <div className="flex items-center justify-between bg-[#f4f6fb] p-3 rounded-xl border border-[#e7edf3]">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
                      disabled={weekOffset === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#e7edf3] text-xs font-bold text-[#081e2c] hover:border-[#087f71] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      <ChevronLeft size={16} /> Précédente
                    </button>

                    <span className="text-xs font-bold text-[#081e2c] tracking-wide">
                      Semaine du {currentWeekDays[0].getDate()} {currentWeekDays[0].toLocaleDateString("fr-FR", { month: "short" })} au {currentWeekDays[4].getDate()} {currentWeekDays[4].toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </span>

                    <button
                      type="button"
                      onClick={() => setWeekOffset((prev) => prev + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#e7edf3] text-xs font-bold text-[#081e2c] hover:border-[#087f71] transition-all shadow-sm"
                    >
                      Suivante <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Grille des 5 jours (Lundi à Vendredi) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    {currentWeekDays.map((dayDate, dIdx) => {
                      const slots = getDaySlots(dayDate);
                      const isToday = dayDate.toDateString() === new Date().toDateString();

                      return (
                        <div key={dIdx} className="bg-[#f4f6fb] rounded-xl p-3 border border-[#e7edf3] flex flex-col min-h-[220px]">
                          {/* En-tête du jour */}
                          <div className="text-center pb-2 border-b border-[#e7edf3] mb-2.5">
                            <p className="text-[10px] font-bold uppercase text-[#758396]">
                              {dayDate.toLocaleDateString("fr-FR", { weekday: "short" })}
                            </p>
                            <p className={`text-sm font-bold ${isToday ? "text-[#087f71]" : "text-[#081e2c]"}`}>
                              {dayDate.getDate()} {dayDate.toLocaleDateString("fr-FR", { month: "short" })}
                            </p>
                          </div>

                          {/* Blocs d'horaires */}
                          <div className="flex-1 space-y-2">
                            {slots.length === 0 ? (
                              <p className="text-[10px] text-[#758396] text-center pt-8 italic">Aucun créneau</p>
                            ) : (
                              slots.map((s, sIdx) => {
                                const isSelected = selectedIso === s.iso;

                                if (s.isPast || s.isBooked) {
                                  return (
                                    <div
                                      key={sIdx}
                                      className="p-2 rounded-lg bg-gray-200/60 border border-transparent text-[#758396] text-center cursor-not-allowed opacity-60 flex items-center justify-between"
                                      title={s.isPast ? "Créneau passé" : "Déjà réservé"}
                                    >
                                      <span className="text-[11px] font-medium">{s.time}</span>
                                      <Ban size={12} className="text-red-400" />
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => {
                                      setSelectedIso(s.iso);
                                      setSelectedLabel(
                                        `${dayDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${s.time}`
                                      );
                                    }}
                                    className={`w-full p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-between ${
                                      isSelected
                                        ? "bg-[#087f71] text-white border-[#087f71] shadow-sm"
                                        : "bg-white text-[#081e2c] border-[#e7edf3] hover:border-[#087f71] hover:bg-emerald-50/50"
                                    }`}
                                  >
                                    <span>{s.time}</span>
                                    {isSelected ? <Check size={14} /> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VUE B : PROPOSER UN CRÉNEAU SUR-MESURE */}
              {bookingMode === "custom" && (
                <div className="p-5 bg-[#f4f6fb] rounded-2xl border border-[#e7edf3] space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#081e2c]">Proposer une date libre</h3>
                    <p className="text-xs text-[#758396] mt-0.5">
                      Si les horaires de Nelson ne correspondent pas à vos contraintes, proposez-lui un moment précis.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-1.5">Date</label>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full bg-white border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-1.5">Heure</label>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full bg-white border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* FORMULAIRE FINAL : ORDRE DU JOUR & ENVOI */}
              {(selectedIso || (bookingMode === "custom" && customDate && customTime)) && (
                <form onSubmit={handleSubmitBooking} className="p-5 bg-white border border-[#087f71]/30 rounded-2xl space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#087f71]">
                    <CheckCircle2 size={16} />
                    <span>Créneau sélectionné : {bookingMode === "calendar" ? selectedLabel : `${customDate} à ${customTime}`}</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-1.5">
                      Ordre du jour de la session (Obligatoire)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Indiquez clairement ce que vous souhaitez aborder pendant la séance..."
                      value={agendaNotes}
                      onChange={(e) => setAgendaNotes(e.target.value)}
                      required
                      className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl p-3 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                    />
                  </div>

                  {errorMsg && <p className="text-xs text-red-500 font-semibold">{errorMsg}</p>}

                  <button
                    type="submit"
                    disabled={isSubmitting || !agendaNotes.trim()}
                    className="w-full bg-[#087f71] hover:bg-[#066459] text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSubmitting ? "Envoi de la demande..." : "Confirmer et bloquer ce créneau"}
                  </button>
                </form>
              )}

            </div>
          )}
        </div>

        {/* COLONNE DROITE (1 colonne) : Liste des rendez-vous et comptes-rendus */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider">Vos Rendez-vous</h2>

          {appointments.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-[#e7edf3] text-center text-[#758396]">
              <Calendar size={32} className="mx-auto mb-2 opacity-30 text-[#081e2c]" />
              <p className="text-xs font-semibold">Aucun rendez-vous enregistré.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {appointments.map((apt) => {
                const aptDate = new Date(apt.date_time);
                const isPassed = aptDate < new Date();
                const isConfirmed = apt.status === "confirme" || apt.status === "accepted";
                const isCancelled = apt.status === "annule" || apt.status === "cancelled" || apt.status === "rejected";

                return (
                  <div
                    key={apt.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCancelled
                        ? "bg-[#f4f6fb]/50 border-[#e7edf3] opacity-60"
                        : isPassed
                        ? "bg-white border-[#e7edf3] opacity-80"
                        : "bg-white border-[#e7edf3] shadow-sm hover:border-[#087f71]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#081e2c] capitalize">
                        {aptDate.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      <span className="text-xs font-semibold text-[#758396] flex items-center gap-1">
                        <Clock size={12} /> {aptDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#e7edf3]">
                      <div>
                        {isConfirmed ? (
                          <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Confirmé
                          </span>
                        ) : isCancelled ? (
                          <span className="text-[10px] font-bold uppercase text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Annulé
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase text-[#c5a059] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                            En attente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isConfirmed && apt.meet_link && !isPassed && (
                          <a
                            href={apt.meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#081e2c] text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                          >
                            <Video size={12} className="text-[#087f71]" /> Meet
                          </a>
                        )}

                        {!isCancelled && !isConfirmed && !isPassed && (
                          <button
                            onClick={() => handleCancelAppointment(apt.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold px-1"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>

                    {apt.agenda_notes && (
                      <div className="mt-2.5 p-2 bg-[#f4f6fb] rounded-lg text-[11px] text-[#758396]">
                        <span className="font-bold text-[#081e2c] block">Ordre du jour :</span>
                        {apt.agenda_notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}