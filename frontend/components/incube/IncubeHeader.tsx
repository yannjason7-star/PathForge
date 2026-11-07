"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Plus, UploadCloud, X, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function IncubeHeader({ firstName, createdAt, projectId }: { firstName: string, createdAt: string, projectId: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathSegments = pathname.split('/').filter(Boolean);
  const currentPage = pathSegments.length > 1 ? pathSegments[pathSegments.length - 1] : "Vue d'ensemble";

  // Calcul dynamique de la semaine d'incubation
  const diffTime = Math.abs(new Date().getTime() - new Date(createdAt).getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil(diffDays / 7) || 1;

  // États du Modal d'upload
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!file || !projectId) return;
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('deliverables').upload(`${projectId}/${fileName}`, file);
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('deliverables').getPublicUrl(`${projectId}/${fileName}`);
      await supabase.from('deliverables').insert({
        project_id: projectId, file_url: publicUrl.publicUrl, status: 'en_attente'
      });

      setFile(null);
      setIsModalOpen(false);
      router.refresh();
      alert("Livrable envoyé avec succès à votre mentor !");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'envoi.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#e7edf3] flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-[#758396]">PathForge</span><span className="text-[#e7edf3]">/</span>
          <span className="text-[#081e2c] capitalize">{currentPage.replace(/-/g, ' ')}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex px-3 py-1 bg-[#f4f6fb] border border-[#e7edf3] rounded-full text-[11px] font-bold text-[#758396] tracking-wider">
            SEMAINE {weekNumber}
          </div>

          <button onClick={() => setIsModalOpen(true)} className="bg-[#087f71] hover:bg-[#066459] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
            <Plus size={16} /><span>Nouveau Livrable</span>
          </button>

          <button className="relative text-[#758396] hover:text-[#081e2c] transition-colors p-2 rounded-full hover:bg-[#f4f6fb]">
            <Bell size={18} />
          </button>

          <div className="flex items-center gap-3 ml-2 border-l border-[#e7edf3] pl-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-[#081e2c]">{firstName}</p>
              <p className="text-[10px] text-[#087f71] font-bold uppercase tracking-wider">Incubé</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#e6f2f1] flex items-center justify-center text-[#087f71] font-bold text-sm">
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* MODAL GLOBAL D'UPLOAD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#081e2c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[#081e2c]">Soumettre un livrable</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#758396] hover:text-[#081e2c]"><X size={20} /></button>
            </div>
            {!projectId ? (
              <p className="text-sm text-orange-600 bg-orange-50 p-3 rounded-lg font-medium">⚠️ Vous devez avoir un projet actif pour uploader un document.</p>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-[#e7edf3] rounded-xl p-8 text-center bg-[#f4f6fb]">
                  <UploadCloud size={32} className="mx-auto text-[#087f71] mb-2" />
                  <input type="file" id="modal-upload" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <label htmlFor="modal-upload" className="cursor-pointer bg-white border border-[#e7edf3] text-[#081e2c] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#f4f6fb]">Parcourir</label>
                </div>
                {file && <div className="flex items-center gap-2 p-2 bg-[#e6f2f1] rounded text-sm text-[#087f71] font-semibold"><FileText size={16}/> {file.name}</div>}
                <button onClick={handleUpload} disabled={!file || isUploading} className="w-full bg-[#081e2c] text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                  {isUploading ? "Envoi en cours..." : "Soumettre au mentor"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}