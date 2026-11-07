"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PlayCircle, CheckCircle, FileText, ChevronLeft, Award } from "lucide-react";
import { useRouter } from "next/navigation";

type Formation = { id: string; title: string; type: string; file_url: string };
type Progression = { formation_id: string; is_completed: boolean; score_quiz: number };

export default function FormationsClient({ 
  initialFormations, 
  initialProgressions, 
  userId 
}: { 
  initialFormations: Formation[], 
  initialProgressions: Progression[], 
  userId: string 
}) {
  const router = useRouter();
  const [activeVideo, setActiveVideo] = useState<Formation | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progressions, setProgressions] = useState<Progression[]>(initialProgressions);

  const isCompleted = (formationId: string) => 
    progressions.some(p => p.formation_id === formationId && p.is_completed);

  const markAsCompleted = async () => {
    if (!activeVideo) return;
    setIsUpdating(true);

    // 1. Sauvegarde dans Supabase
    const { error } = await supabase.from("progressions").upsert({
      user_id: userId,
      formation_id: activeVideo.id,
      is_completed: true,
      score_quiz: showQuiz ? 100 : 0 // Simulation de note parfaite au quiz
    }, { onConflict: 'user_id, formation_id' });

    if (!error) {
      // 2. Mise à jour de l'affichage local
      setProgressions(prev => [...prev.filter(p => p.formation_id !== activeVideo.id), {
        formation_id: activeVideo.id, is_completed: true, score_quiz: 100
      }]);
      setShowQuiz(false);
      setActiveVideo(null);
      router.refresh(); // Force la mise à jour des stats globales du serveur
    }
    setIsUpdating(false);
  };

  // --- VUE LECTEUR VIDÉO / QUIZ ---
  if (activeVideo) {
    return (
      <div className="space-y-6">
        <button onClick={() => { setActiveVideo(null); setShowQuiz(false); }} className="flex items-center gap-2 text-sm font-semibold text-[#758396] hover:text-[#081e2c] transition-colors">
          <ChevronLeft size={16} /> Retour aux formations
        </button>

        <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm overflow-hidden">
          {/* Lecteur simulé */}
          <div className="aspect-video bg-[#081e2c] flex flex-col items-center justify-center relative">
            <PlayCircle size={64} className="text-[#087f71] mb-4 opacity-80" />
            <p className="text-white font-medium text-lg">{activeVideo.title}</p>
            <p className="text-[#758396] text-sm mt-2">{activeVideo.type === 'video' ? 'Lecture en cours...' : 'Document PDF'}</p>
          </div>

          <div className="p-8">
            <h1 className="text-2xl font-bold text-[#081e2c] mb-2">{activeVideo.title}</h1>
            <p className="text-[#758396] mb-8">Visionnez l'intégralité du module avant de valider vos acquis.</p>

            {!showQuiz ? (
              <button onClick={() => setShowQuiz(true)} className="bg-[#081e2c] hover:bg-[#172538] text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2">
                Passer le Quiz de validation
              </button>
            ) : (
              <div className="bg-[#f4f6fb] p-6 rounded-xl border border-[#e7edf3]">
                <div className="flex items-center gap-2 mb-4 text-[#087f71]">
                  <Award size={24} />
                  <h2 className="text-lg font-bold text-[#081e2c]">Quiz de validation</h2>
                </div>
                <p className="text-sm font-medium text-[#172538] mb-6">Avez-vous bien assimilé les concepts clés de ce module concernant votre incubation ?</p>
                <button 
                  onClick={markAsCompleted} 
                  disabled={isUpdating}
                  className="bg-[#087f71] hover:bg-[#066459] text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isUpdating ? "Validation en cours..." : "Oui, terminer ce module"} <CheckCircle size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- VUE LISTE DES FORMATIONS ---
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Vos Formations</h1>
        <p className="text-[#758396] text-sm font-medium">Consultez les ressources et validez vos modules d'incubation.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialFormations.length === 0 && (
          <p className="text-[#758396] text-sm col-span-full">Aucune formation disponible pour le moment.</p>
        )}
        
        {initialFormations.map((formation) => {
          const completed = isCompleted(formation.id);
          
          return (
            <div key={formation.id} className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm overflow-hidden flex flex-col group hover:border-[#087f71] transition-all cursor-pointer" onClick={() => setActiveVideo(formation)}>
              {/* Image de couverture factice */}
              <div className="h-40 bg-[#f4f6fb] flex items-center justify-center relative">
                {formation.type === 'video' ? <PlayCircle size={40} className="text-[#758396] group-hover:text-[#087f71] transition-colors" /> : <FileText size={40} className="text-[#758396] group-hover:text-[#087f71] transition-colors" />}
                {completed && (
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <CheckCircle size={12} /> Terminé
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#087f71] uppercase tracking-wider mb-2">Module d'incubation</div>
                  <h3 className="text-lg font-bold text-[#081e2c] leading-tight mb-2 group-hover:text-[#087f71] transition-colors">{formation.title}</h3>
                </div>
                <div className="mt-4 pt-4 border-t border-[#e7edf3] text-xs font-semibold text-[#758396] flex items-center justify-between">
                  <span>Format {formation.type}</span>
                  <span className="text-[#081e2c]">Ouvrir le cours →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}