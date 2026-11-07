"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { UploadCloud, FileText, CheckCircle, Clock, MessageSquare, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Project = { id: string; title: string; description: string; status: string };
type Deliverable = { id: string; file_url: string; status: string; feedback_mentor: string | null; created_at: string };

export default function ProjectClient({ project, initialDeliverables }: { project: Project | null, initialDeliverables: Deliverable[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg("");
    }
  };

  const handleUpload = async () => {
    if (!file || !project) return;
    setIsUploading(true);
    setErrorMsg("");

    try {
      // 1. Générer un nom unique pour le fichier
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${project.id}/${fileName}`;

      // 2. Upload dans Supabase Storage (Bucket 'deliverables')
      const { error: uploadError } = await supabase.storage
        .from('deliverables')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Récupérer l'URL publique
      const { data: publicUrlData } = supabase.storage
        .from('deliverables')
        .getPublicUrl(filePath);

      // 4. Insérer dans la table deliverables
      const { error: dbError } = await supabase.from('deliverables').insert({
        project_id: project.id,
        file_url: publicUrlData.publicUrl,
        status: 'en_attente',
        feedback_mentor: null
      });

      if (dbError) throw dbError;

      // 5. Succès : on réinitialise et on rafraîchit la page
      setFile(null);
      router.refresh();
      
    } catch (error: any) {
      console.error("Erreur d'upload:", error);
      setErrorMsg("Une erreur est survenue lors de l'envoi du document. Vérifiez que le bucket 'deliverables' existe bien sur Supabase.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!project) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#e7edf3] text-center">
        <AlertCircle size={40} className="mx-auto text-[#758396] mb-4" />
        <h2 className="text-xl font-bold text-[#081e2c]">Aucun projet actif</h2>
        <p className="text-[#758396] mt-2">Vous n'avez pas encore de projet assigné à votre profil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Informations du Projet */}
      <div>
        <div className="inline-block px-3 py-1 bg-[#e6f2f1] text-[#087f71] text-[10px] font-bold rounded uppercase tracking-wider mb-3">
          Statut : {project.status}
        </div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">{project.title}</h1>
        <p className="text-[#758396] font-medium max-w-3xl">{project.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. Zone d'Upload (Colonne principale) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm">
            <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider mb-4">Nouveau Livrable</h2>
            
            <div className="border-2 border-dashed border-[#e7edf3] rounded-xl p-8 text-center hover:border-[#087f71] transition-colors bg-[#f4f6fb]">
              <UploadCloud size={32} className="mx-auto text-[#087f71] mb-3" />
              <p className="text-sm font-semibold text-[#081e2c] mb-1">Uploader un document (PDF)</p>
              <p className="text-xs text-[#758396] mb-4">Taille maximum : 10MB</p>
              
              <input type="file" id="file-upload" accept=".pdf" className="hidden" onChange={handleFileChange} disabled={isUploading} />
              <label htmlFor="file-upload" className="cursor-pointer bg-white border border-[#e7edf3] text-[#081e2c] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6fb] transition-colors inline-block">
                Parcourir
              </label>
            </div>

            {file && (
              <div className="mt-4 p-3 bg-[#e6f2f1] rounded-lg border border-[#087f71]/20 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText size={16} className="text-[#087f71] flex-shrink-0" />
                  <span className="text-sm font-semibold text-[#081e2c] truncate">{file.name}</span>
                </div>
              </div>
            )}

            {errorMsg && <p className="text-xs text-red-500 font-medium mt-3">{errorMsg}</p>}

            <button 
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full mt-6 bg-[#081e2c] hover:bg-[#172538] text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Envoi en cours..." : "Soumettre au mentor"}
            </button>
          </div>
        </div>

        {/* 3. Historique & Feedbacks (Colonnes secondaires) */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm h-full">
            <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider mb-6">Historique des Livrables</h2>
            
            {initialDeliverables.length === 0 ? (
              <p className="text-[#758396] text-sm">Aucun livrable déposé pour le moment.</p>
            ) : (
              <div className="space-y-4">
                {initialDeliverables.map((doc) => (
                  <div key={doc.id} className="p-4 rounded-xl border border-[#e7edf3] flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#f4f6fb] flex items-center justify-center text-[#758396]">
                          <FileText size={20} />
                        </div>
                       <div className="min-w-0">
                          <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm font-bold text-[#081e2c] hover:text-[#087f71] underline truncate block"
                          >
                            {doc.file_url.split('/').pop()?.replace(/^\d+_/, '') || "Document PDF"}
                          </a>
                          <p className="text-xs font-medium text-[#758396]">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      
                      {doc.status === 'validé' ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                          <CheckCircle size={12} /> Validé
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#c5a059] bg-orange-50 px-2 py-1 rounded">
                          <Clock size={12} /> En attente
                        </span>
                      )}
                    </div>
                    
                    {doc.feedback_mentor && (
                      <div className="bg-[#f4f6fb] p-3 rounded-lg border-l-2 border-[#087f71] flex items-start gap-3">
                        <MessageSquare size={16} className="text-[#087f71] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-[#081e2c] mb-1">Retour du mentor :</p>
                          <p className="text-sm text-[#172538] font-medium leading-relaxed">{doc.feedback_mentor}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}