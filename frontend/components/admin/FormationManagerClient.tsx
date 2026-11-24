"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Video, 
  FileText, 
  UploadCloud, 
  Search, 
  ExternalLink, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  X,
  FileCheck
} from "lucide-react";

export type Formation = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  file_url: string;
  created_at: string;
};

export default function FormationManagerClient({ 
  initialFormations 
}: { 
  initialFormations: Formation[] 
}) {
  const router = useRouter();
  const [formations, setFormations] = useState<Formation[]>(initialFormations);
  
  // États du formulaire
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"video" | "pdf">("video");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Quiz associé (Optionnel)
  // Quiz multi-questions
  type QuizItem = { question_text: string; options: string[]; correct_answer: string };
  const [quizQuestions, setQuizQuestions] = useState<QuizItem[]>([]);
  const [currentQ, setCurrentQ] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [correctOpt, setCorrectOpt] = useState("A");

  const addQuestionToQuiz = () => {
    if (!currentQ.trim() || !optA.trim() || !optB.trim()) return;
    setQuizQuestions([
      ...quizQuestions,
      {
        question_text: currentQ.trim(),
        options: [optA.trim(), optB.trim()],
        correct_answer: correctOpt === "A" ? optA.trim() : optB.trim(),
      },
    ]);
    setCurrentQ("");
    setOptA("");
    setOptB("");
  };

  // Filtres & recherche
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "pdf">("all");

  // Métriques
  const stats = useMemo(() => {
    const total = formations.length;
    const videos = formations.filter(f => f.type === 'video').length;
    const pdfs = formations.filter(f => f.type === 'pdf').length;
    return { total, videos, pdfs };
  }, [formations]);

  // Filtrage
  const filteredFormations = useMemo(() => {
    return formations.filter((f) => {
      const matchSearch = f.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (f.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === "all" || f.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [formations, searchTerm, typeFilter]);

  // Publication d'un nouveau cours
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      setErrorMsg("Veuillez renseigner un titre et sélectionner un fichier.");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");

    try {
      // 1. Upload vers le bucket Supabase "formations"
      const fileExt = file.name.split('.').pop();
      const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${type}/${cleanFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('formations')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique
      const { data: publicUrlData } = supabase.storage
        .from('formations')
        .getPublicUrl(filePath);

      // 3. Insertion dans la table public.formations
      const { data: insertedData, error: dbError } = await supabase
        .from("formations")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          type: type,
          file_url: publicUrlData.publicUrl
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Sauvegarde des questions du quiz si présentes
      if (quizQuestions.length > 0) {
        const questionsToInsert = quizQuestions.map((q) => ({
          formation_id: insertedData.id,
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
        }));
        await supabase.from("quiz_questions").insert(questionsToInsert);
      }

      // Mise à jour locale
      setFormations([insertedData, ...formations]);
      setQuizQuestions([]);
      
      // Réinitialisation du formulaire
      setTitle("");
      setDescription("");
      setFile(null);
      setQuizQuestions([]);
      setCurrentQ("");
      setOptA("");
      setOptB("");
      router.refresh();
      alert("Formation publiée avec succès dans le catalogue !");

    } catch (err: any) {
      console.error("Erreur publication formation:", err);
      setErrorMsg(`Erreur : ${err?.message || "Impossible de publier la formation. Vérifiez que le bucket 'formations' existe bien."}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Suppression d'un module
  const handleDelete = async (id: string, titleToDelete: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement le module "${titleToDelete}" ?`)) return;

    try {
      const { error } = await supabase
        .from("formations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setFormations(formations.filter(f => f.id !== id));
      router.refresh();
    } catch (err: any) {
      console.error("Erreur suppression:", err);
      alert(`Erreur : ${err?.message || "Action impossible"}`);
    }
  };

  return (
    <div className="space-y-8 pb-10">

      {/* 1. Métriques Pédagogiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Catalogue Global</p>
            <p className="text-3xl font-bold text-[#081e2c] mt-1">{stats.total}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <BookOpen size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Modules Vidéo</p>
            <p className="text-3xl font-bold text-[#087f71] mt-1">{stats.videos}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center">
            <Video size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Ressources & Guides PDF</p>
            <p className="text-3xl font-bold text-[#c5a059] mt-1">{stats.pdfs}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#c5a059] flex items-center justify-center">
            <FileText size={22} />
          </div>
        </div>
      </div>

      {/* 2. Zone Principale (Formulaire à gauche, Liste à droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Formulaire de Publication (Colonne Gauche) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm sticky top-28">
          <div className="flex items-center gap-2 mb-6 text-[#081e2c]">
            <Plus size={20} className="text-[#087f71]" />
            <h2 className="text-lg font-bold">Publier un nouveau module</h2>
          </div>

          <form onSubmit={handlePublish} className="space-y-4">
            
            {/* Format (Type) */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">Format pédagogique</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("video")}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    type === "video" 
                      ? "border-[#087f71] bg-[#e6f2f1] text-[#087f71] shadow-sm" 
                      : "border-[#e7edf3] bg-[#f4f6fb] text-[#758396] hover:text-[#081e2c]"
                  }`}
                >
                  <Video size={16} /> Vidéo
                </button>
                <button
                  type="button"
                  onClick={() => setType("pdf")}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    type === "pdf" 
                      ? "border-[#087f71] bg-[#e6f2f1] text-[#087f71] shadow-sm" 
                      : "border-[#e7edf3] bg-[#f4f6fb] text-[#758396] hover:text-[#081e2c]"
                  }`}
                >
                  <FileText size={16} /> Support PDF
                </button>
              </div>
            </div>

            {/* Titre */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">Titre du cours</label>
              <input
                type="text"
                placeholder="Ex: Structurer sa proposition de valeur"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71] transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">Objectifs d'apprentissage</label>
              <textarea
                rows={3}
                placeholder="Décrivez les compétences acquises par l'incubé..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl p-3 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71] transition-all"
              />
            </div>

            {/* Téléversement Fichier */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">Fichier source</label>
              <div className="border-2 border-dashed border-[#e7edf3] rounded-xl p-4 text-center bg-[#f4f6fb] hover:border-[#087f71] transition-colors">
                <UploadCloud size={24} className="mx-auto text-[#087f71] mb-1.5" />
                <input 
                  type="file" 
                  id="formation-file" 
                  accept={type === 'video' ? 'video/mp4,video/webm' : '.pdf'} 
                  className="hidden" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label 
                  htmlFor="formation-file" 
                  className="cursor-pointer text-xs font-bold text-[#081e2c] hover:text-[#087f71] inline-block"
                >
                  {file ? file.name : "Sélectionner le fichier sur votre PC"}
                </label>
              </div>
            </div>

           {/* Constructeur de Quiz Multi-questions */}
            <div className="pt-3 border-t border-[#e7edf3] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#081e2c] flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-[#087f71]" /> Questions du Quiz ({quizQuestions.length})
                </span>
              </div>

              {/* Formulaire d'ajout d'une question */}
              <div className="p-3 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] space-y-2">
                <input
                  type="text"
                  placeholder="Énoncé de la question..."
                  value={currentQ}
                  onChange={(e) => setCurrentQ(e.target.value)}
                  className="w-full bg-white border border-[#e7edf3] rounded-lg p-2 text-xs text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Option A"
                    value={optA}
                    onChange={(e) => setOptA(e.target.value)}
                    className="bg-white border border-[#e7edf3] rounded-lg p-2 text-xs text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                  />
                  <input
                    type="text"
                    placeholder="Option B"
                    value={optB}
                    onChange={(e) => setOptB(e.target.value)}
                    className="bg-white border border-[#e7edf3] rounded-lg p-2 text-xs text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs text-[#758396]">
                    <span>Bonne réponse :</span>
                    <select
                      value={correctOpt}
                      onChange={(e) => setCorrectOpt(e.target.value)}
                      className="bg-white border border-[#e7edf3] rounded px-2 py-0.5 text-xs font-bold text-[#081e2c]"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addQuestionToQuiz}
                    disabled={!currentQ || !optA || !optB}
                    className="px-2.5 py-1 bg-[#087f71] text-white text-[11px] font-bold rounded-md hover:bg-[#066459] disabled:opacity-40"
                  >
                    + Ajouter
                  </button>
                </div>
              </div>

              {/* Liste des questions ajoutées */}
              {quizQuestions.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="p-2 bg-white border border-[#e7edf3] rounded-lg flex items-center justify-between text-xs">
                      <span className="truncate max-w-[200px] font-medium text-[#081e2c]">{idx + 1}. {q.question_text}</span>
                      <button
                        type="button"
                        onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && <p className="text-xs text-red-500 font-medium">{errorMsg}</p>}

            <button
              type="submit"
              disabled={isUploading || !title || !file}
              className="w-full bg-[#081e2c] hover:bg-[#172538] text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isUploading ? "Téléversement en cours..." : "Publier dans le catalogue"}
            </button>
          </form>
        </div>

        {/* Liste des Cours (Colonne Droite) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Barre de Recherche et Filtres */}
          <div className="bg-white p-4 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center px-3 py-2 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] w-full sm:max-w-xs focus-within:bg-white focus-within:border-[#087f71] transition-all">
              <Search size={16} className="text-[#758396] mr-2" />
              <input
                type="text"
                placeholder="Rechercher une formation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-[#081e2c] placeholder:text-[#758396]"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              {[
                { id: "all", label: "Tous" },
                { id: "video", label: "Vidéos" },
                { id: "pdf", label: "PDFs" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setTypeFilter(filter.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                    typeFilter === filter.id
                      ? "bg-[#081e2c] text-white shadow-sm"
                      : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3] hover:text-[#081e2c]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cartes des Formations */}
          {filteredFormations.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-[#e7edf3] text-center text-[#758396]">
              <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Aucun module ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFormations.map((f) => (
                <div 
                  key={f.id} 
                  className="bg-white p-5 rounded-2xl border border-[#e7edf3] hover:border-[#087f71] transition-all shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      f.type === 'video' ? 'bg-[#e6f2f1] text-[#087f71]' : 'bg-orange-50 text-[#c5a059]'
                    }`}>
                      {f.type === 'video' ? <Video size={22} /> : <FileText size={22} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#f4f6fb] text-[#758396] border border-[#e7edf3]">
                          {f.type}
                        </span>
                        <h3 className="text-base font-bold text-[#081e2c]">{f.title}</h3>
                      </div>
                      <p className="text-xs text-[#758396] mt-1 line-clamp-1 max-w-md">
                        {f.description || "Aucune description renseignée."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[#758396] hover:text-[#087f71] hover:bg-[#e6f2f1] rounded-lg transition-colors"
                      title="Consulter le fichier"
                    >
                      <ExternalLink size={18} />
                    </a>
                    <button
                      onClick={() => handleDelete(f.id, f.title)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer la formation"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}