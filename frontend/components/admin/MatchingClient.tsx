"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  UserCheck, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  UserPlus, 
  Users, 
  FolderKanban, 
  X, 
  ChevronRight,
  UserX,
  Sparkles
} from "lucide-react";

export type MentorOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type IncubeInfo = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type ProjectWithRelations = {
  id: string;
  title: string;
  description: string;
  status: string;
  incube_id: string;
  mentor_id: string | null;
  created_at: string;
  incube: IncubeInfo | null;
  mentor: MentorOption | null;
};

export default function MatchingClient({
  initialProjects,
  mentorsList,
}: {
  initialProjects: ProjectWithRelations[];
  mentorsList: MentorOption[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithRelations[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "unmatched" | "matched">("all");

  // Modal d'assignation
  const [activeProject, setActiveProject] = useState<ProjectWithRelations | null>(null);
  const [selectedMentorId, setSelectedMentorId] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Statistiques rapides
  const stats = useMemo(() => {
    const total = projects.length;
    const unmatched = projects.filter((p) => !p.mentor_id).length;
    const matched = total - unmatched;
    return { total, unmatched, matched, availableMentors: mentorsList.length };
  }, [projects, mentorsList]);

  // 2. Filtrage & recherche
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${p.incube?.first_name || ""} ${p.incube?.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${p.mentor?.first_name || ""} ${p.mentor?.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());

      if (filter === "unmatched") return matchSearch && !p.mentor_id;
      if (filter === "matched") return matchSearch && !!p.mentor_id;
      return matchSearch;
    });
  }, [projects, searchTerm, filter]);

  // 3. Action : Assigner ou modifier le mentor
  const handleAssignMentor = async () => {
    if (!activeProject || !selectedMentorId) return;
    setIsUpdating(true);

    try {
      const newMentor = mentorsList.find((m) => m.id === selectedMentorId) || null;

      const { error } = await supabase
        .from("projects")
        .update({ mentor_id: selectedMentorId })
        .eq("id", activeProject.id);

      if (error) throw error;

      // Mise à jour optimiste locale
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id ? { ...p, mentor_id: selectedMentorId, mentor: newMentor } : p
        )
      );

      setActiveProject(null);
      setSelectedMentorId("");
      router.refresh();
    } catch (err: any) {
      console.error("Erreur assignation mentor:", err);
      alert(`Erreur: ${err?.message || "Impossible d'assigner le mentor"}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // 4. Action : Dissocier le mentor (délier le binôme)
  const handleUnassignMentor = async (project: ProjectWithRelations) => {
    if (!confirm(`Retirer le mentor du projet "${project.title}" ?`)) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ mentor_id: null })
        .eq("id", project.id);

      if (error) throw error;

      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, mentor_id: null, mentor: null } : p))
      );
      router.refresh();
    } catch (err: any) {
      console.error("Erreur retrait mentor:", err);
      alert(`Erreur: ${err?.message || "Action impossible"}`);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Métriques de matching */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Total Projets</p>
            <p className="text-2xl font-bold text-[#081e2c] mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <FolderKanban size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">À Assigner (Orphelins)</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.unmatched}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Binômes Actifs</p>
            <p className="text-2xl font-bold text-[#087f71] mt-1">{stats.matched}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Mentors Disponibles</p>
            <p className="text-2xl font-bold text-[#081e2c] mt-1">{stats.availableMentors}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* 2. Filtres & Recherche */}
      <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center px-4 py-2.5 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] max-w-md w-full focus-within:border-[#087f71] focus-within:bg-white transition-all">
          <Search size={18} className="text-[#758396] mr-2.5" />
          <input
            type="text"
            placeholder="Rechercher par projet, incubé ou mentor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full text-[#081e2c] placeholder:text-[#758396]"
          />
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: "all", label: "Tous" },
            { id: "unmatched", label: "Sans mentor" },
            { id: "matched", label: "Binômes actifs" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                filter === f.id
                  ? "bg-[#081e2c] text-white shadow-sm"
                  : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3] hover:text-[#081e2c]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Tableau de Matching */}
      <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f4f6fb] text-[#758396] uppercase text-[10px] font-bold tracking-wider border-b border-[#e7edf3]">
              <tr>
                <th className="px-6 py-4">Projet & Statut</th>
                <th className="px-6 py-4">Incubé Porteur</th>
                <th className="px-6 py-4">Mentor Référent</th>
                <th className="px-6 py-4 text-right">Action Matching</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7edf3]">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#758396]">
                    Aucun projet ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const hasMentor = !!project.mentor;

                  return (
                    <tr key={project.id} className="hover:bg-[#f4f6fb]/60 transition-colors">
                      {/* Projet */}
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <p className="font-bold text-[#081e2c] truncate">{project.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#e7edf3] text-[#081e2c]">
                              {project.status}
                            </span>
                            <span className="text-xs text-[#758396] line-clamp-1">{project.description}</span>
                          </div>
                        </div>
                      </td>

                      {/* Incubé */}
                      <td className="px-6 py-4">
                        {project.incube ? (
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#e6f2f1] text-[#087f71] flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {(project.incube.first_name?.[0] || "I")}{(project.incube.last_name?.[0] || "")}
                            </div>
                            <div>
                              <p className="font-bold text-[#081e2c]">
                                {project.incube.first_name} {project.incube.last_name}
                              </p>
                              <p className="text-xs text-[#758396]">{project.incube.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#758396] italic">Profil incubé introuvable</span>
                        )}
                      </td>

                      {/* Mentor */}
                      <td className="px-6 py-4">
                        {hasMentor && project.mentor ? (
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#081e2c] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {(project.mentor.first_name?.[0] || "M")}{(project.mentor.last_name?.[0] || "")}
                            </div>
                            <div>
                              <p className="font-bold text-[#081e2c]">
                                {project.mentor.first_name} {project.mentor.last_name}
                              </p>
                              <p className="text-xs text-[#087f71] font-semibold">{project.mentor.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            <AlertCircle size={12} /> À assigner
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setActiveProject(project);
                              setSelectedMentorId(project.mentor_id || "");
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                              hasMentor
                                ? "bg-[#f4f6fb] text-[#081e2c] border border-[#e7edf3] hover:border-[#087f71]"
                                : "bg-[#087f71] hover:bg-[#066459] text-white"
                            }`}
                          >
                            <UserCheck size={14} />
                            {hasMentor ? "Changer" : "Assigner"}
                          </button>

                          {hasMentor && (
                            <button
                              onClick={() => handleUnassignMentor(project)}
                              title="Retirer le mentor"
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <UserX size={16} />
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

      {/* 4. MODAL D'ASSIGNATION DE MENTOR */}
      {activeProject && (
        <div className="fixed inset-0 bg-[#081e2c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#e7edf3] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-[#e7edf3] bg-[#f4f6fb] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#081e2c]">
                <Sparkles size={20} className="text-[#087f71]" />
                <h3 className="text-lg font-bold">Matching Mentorat</h3>
              </div>
              <button
                onClick={() => {
                  setActiveProject(null);
                  setSelectedMentorId("");
                }}
                className="text-[#758396] hover:text-[#081e2c] p-1.5 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-6 space-y-5">
              <div className="bg-[#f4f6fb] p-4 rounded-xl border border-[#e7edf3] text-xs space-y-1">
                <p className="text-[#758396] uppercase font-bold text-[10px]">Projet cible</p>
                <p className="text-sm font-bold text-[#081e2c]">{activeProject.title}</p>
                <p className="text-[#758396]">
                  Porté par : <span className="text-[#081e2c] font-semibold">{activeProject.incube?.first_name} {activeProject.incube?.last_name}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                  Sélectionner un Mentor disponible
                </label>
                
                {mentorsList.length === 0 ? (
                  <p className="text-xs text-orange-600 font-medium">
                    Aucun mentor actif dans la base de données.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {mentorsList.map((mentor) => {
                      const isSelected = selectedMentorId === mentor.id;

                      return (
                        <button
                          key={mentor.id}
                          type="button"
                          onClick={() => setSelectedMentorId(mentor.id)}
                          className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSelected
                              ? "border-[#087f71] bg-[#e6f2f1] shadow-sm"
                              : "border-[#e7edf3] hover:bg-[#f4f6fb] bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#081e2c] text-white flex items-center justify-center font-bold text-xs">
                              {(mentor.first_name?.[0] || "M")}{(mentor.last_name?.[0] || "")}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#081e2c]">
                                {mentor.first_name} {mentor.last_name}
                              </p>
                              <p className="text-xs text-[#758396]">{mentor.email}</p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={18} className="text-[#087f71]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-6 border-t border-[#e7edf3] bg-[#f4f6fb] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveProject(null);
                  setSelectedMentorId("");
                }}
                className="px-4 py-2 border border-[#e7edf3] text-[#081e2c] text-xs font-bold rounded-xl hover:bg-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAssignMentor}
                disabled={!selectedMentorId || isUpdating}
                className="px-5 py-2 bg-[#087f71] hover:bg-[#066459] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isUpdating ? "Enregistrement..." : "Confirmer le binôme"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}