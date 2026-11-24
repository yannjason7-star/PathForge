"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Building2, 
  Eye, 
  X, 
  Calendar, 
  Mail, 
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from "lucide-react";

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export default function UserTableClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  
  // États de filtrage
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Modal KYC
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // 1. Calcul des statistiques d'en-tête
  const stats = useMemo(() => {
    return {
      total: profiles.length,
      pending: profiles.filter(p => p.status === 'pending').length,
      incubes: profiles.filter(p => p.role === 'incube' && p.status === 'active').length,
      mentors: profiles.filter(p => p.role === 'mentor' && p.status === 'active').length,
    };
  }, [profiles]);

  // 2. Filtrage multi-critères
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, searchTerm, roleFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredProfiles.length / itemsPerPage) || 1;
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProfiles.slice(start, start + itemsPerPage);
  }, [filteredProfiles, currentPage]);

  // 3. Action de mise à jour du statut
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Mise à jour optimiste locale
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );

      // Si le profil examiné est celui modifié, mettre à jour la modal
      if (selectedProfile && selectedProfile.id === id) {
        setSelectedProfile({ ...selectedProfile, status: newStatus });
      }

      router.refresh();
    } catch (err: any) {
      console.error("Erreur de mise à jour KYC:", err);
      alert(`Erreur : ${err?.message || "Action impossible"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* 1. Métriques rapides de gestion */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Total Comptes</p>
            <p className="text-2xl font-bold text-[#081e2c] mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Comptes KYC en attente</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.pending}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Incubés Actifs</p>
            <p className="text-2xl font-bold text-[#087f71] mt-1">{stats.incubes}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Mentors Actifs</p>
            <p className="text-2xl font-bold text-[#081e2c] mt-1">{stats.mentors}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* 2. Barre d'outils (Recherche & Filtres) */}
      <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Recherche */}
          <div className="flex items-center px-4 py-2.5 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] max-w-md w-full focus-within:border-[#087f71] focus-within:bg-white transition-all">
            <Search size={18} className="text-[#758396] mr-2.5" />
            <input 
              type="text"
              placeholder="Rechercher par nom, prénom ou email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="bg-transparent border-none outline-none text-sm w-full text-[#081e2c] placeholder:text-[#758396]"
            />
          </div>

          {/* Filtres par Rôle */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: "all", label: "Tous" },
              { id: "incube", label: "Incubés" },
              { id: "mentor", label: "Mentors" },
              { id: "entreprise", label: "Entreprises" },
              { id: "admin", label: "Admins" },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => { setRoleFilter(r.id); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
                  roleFilter === r.id
                    ? "bg-[#081e2c] text-white shadow-sm"
                    : "bg-[#f4f6fb] text-[#758396] hover:bg-[#e7edf3] hover:text-[#081e2c]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

        </div>

        {/* Filtres par Statut */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#e7edf3] text-xs">
          <span className="text-[#758396] font-bold uppercase tracking-wider text-[10px]">Statut :</span>
          {[
            { id: "all", label: "Tous" },
            { id: "pending", label: "En attente (KYC)" },
            { id: "active", label: "Actifs" },
            { id: "rejected", label: "Rejetés" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => { setStatusFilter(s.id); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                statusFilter === s.id
                  ? "bg-[#087f71] text-white"
                  : "text-[#758396] hover:bg-[#f4f6fb] hover:text-[#081e2c]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Table des Utilisateurs */}
      <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f4f6fb] text-[#758396] uppercase text-[10px] font-bold tracking-wider border-b border-[#e7edf3]">
              <tr>
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Date Inscription</th>
                <th className="px-6 py-4 text-right">Actions Décisives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7edf3]">
              {paginatedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#758396]">
                    Aucun utilisateur ne correspond à ces critères.
                  </td>
                </tr>
              ) : (
                paginatedProfiles.map((p) => {
                  const initiales = `${p.first_name?.[0] || 'U'}${p.last_name?.[0] || ''}`.toUpperCase();
                  const isPending = p.status === 'pending';
                  const isActive = p.status === 'active';

                  return (
                    <tr key={p.id} className="hover:bg-[#f4f6fb]/60 transition-colors">
                      {/* Utilisateur */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#081e2c] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {initiales}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#081e2c] truncate">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-xs text-[#758396] truncate">{p.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Rôle */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          p.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : p.role === 'mentor'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : p.role === 'incube'
                            ? 'bg-[#e6f2f1] text-[#087f71] border border-[#087f71]/20'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {p.role}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-6 py-4">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            <Clock size={12} /> En attente
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={12} /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                            <XCircle size={12} /> Rejeté
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-xs font-medium text-[#758396]">
                        {new Date(p.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedProfile(p)}
                            title="Voir la fiche KYC"
                            className="p-2 text-[#758396] hover:text-[#081e2c] hover:bg-[#f4f6fb] rounded-lg transition-colors"
                          >
                            <Eye size={18} />
                          </button>

                          {isPending && (
                            <button
                              onClick={() => handleUpdateStatus(p.id, 'active')}
                              disabled={isProcessing}
                              title="Valider immédiatement"
                              className="px-3 py-1.5 bg-[#087f71] hover:bg-[#066459] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} /> Valider
                            </button>
                          )}

                          {isActive && p.role !== 'admin' && (
                            <button
                              onClick={() => handleUpdateStatus(p.id, 'rejected')}
                              disabled={isProcessing}
                              title="Suspendre ce compte"
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircle size={18} />
                            </button>
                          )}

                          {p.status === 'rejected' && (
                            <button
                              onClick={() => handleUpdateStatus(p.id, 'active')}
                              disabled={isProcessing}
                              title="Réactiver ce compte"
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <RotateCcw size={18} />
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

        {/* Pagination */}
        <div className="p-4 border-t border-[#e7edf3] flex items-center justify-between text-xs text-[#758396] font-medium">
          <p>
            Affichage de <span className="text-[#081e2c] font-bold">{paginatedProfiles.length}</span> sur <span className="text-[#081e2c] font-bold">{filteredProfiles.length}</span> utilisateur(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-[#e7edf3] rounded-lg hover:bg-[#f4f6fb] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-[#081e2c]">Page {currentPage} sur {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-[#e7edf3] rounded-lg hover:bg-[#f4f6fb] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. MODAL / FICHE DÉTAILLÉE KYC */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-[#081e2c]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#e7edf3] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header Modal */}
            <div className="p-6 border-b border-[#e7edf3] flex items-center justify-between bg-[#f4f6fb]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#081e2c] text-white flex items-center justify-center font-bold text-sm">
                  {`${selectedProfile.first_name?.[0] || 'U'}${selectedProfile.last_name?.[0] || ''}`.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#081e2c]">
                    {selectedProfile.first_name} {selectedProfile.last_name}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-[#e7edf3] text-[#081e2c] text-[10px] font-bold uppercase">
                    Rôle : {selectedProfile.role}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProfile(null)}
                className="text-[#758396] hover:text-[#081e2c] p-1.5 rounded-lg hover:bg-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps Modal */}
            <div className="p-6 space-y-5">
              
              {/* Alerte Statut */}
              {selectedProfile.status === 'pending' ? (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                  <Clock size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-900">Compte en attente de validation</p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      Cet utilisateur est actuellement bloqué sur l'écran "Compte en cours d'analyse". Sa validation déverrouille l'accès à son cockpit.
                    </p>
                  </div>
                </div>
              ) : selectedProfile.status === 'active' ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Compte actif et vérifié</p>
                    <p className="text-xs text-emerald-700 mt-0.5">L'utilisateur accède normalement à la plateforme.</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <XCircle size={20} className="text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-900">Compte rejeté ou suspendu</p>
                    <p className="text-xs text-red-700 mt-0.5">L'accès de cet utilisateur a été révoqué.</p>
                  </div>
                </div>
              )}

              {/* Détails techniques */}
              <div className="bg-[#f4f6fb] rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[#e7edf3]">
                  <span className="text-[#758396] flex items-center gap-1.5 font-medium">
                    <Mail size={14} /> Adresse Email
                  </span>
                  <span className="font-bold text-[#081e2c]">{selectedProfile.email}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[#e7edf3]">
                  <span className="text-[#758396] flex items-center gap-1.5 font-medium">
                    <Calendar size={14} /> Date d'inscription
                  </span>
                  <span className="font-bold text-[#081e2c]">
                    {new Date(selectedProfile.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-[#758396] flex items-center gap-1.5 font-medium">
                    <Fingerprint size={14} /> Identifiant UUID
                  </span>
                  <span className="font-mono text-[10px] text-[#758396] truncate max-w-[200px]">
                    {selectedProfile.id}
                  </span>
                </div>
              </div>

            </div>

            {/* Footer Modal : Actions */}
            <div className="p-6 border-t border-[#e7edf3] bg-[#f4f6fb] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedProfile(null)}
                className="px-4 py-2 border border-[#e7edf3] text-[#081e2c] text-xs font-bold rounded-xl hover:bg-white transition-colors"
              >
                Fermer
              </button>

              {selectedProfile.status !== 'active' && (
                <button
                  onClick={() => handleUpdateStatus(selectedProfile.id, 'active')}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-[#087f71] hover:bg-[#066459] text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} /> Activer le compte
                </button>
              )}

              {selectedProfile.status === 'active' && selectedProfile.role !== 'admin' && (
                <button
                  onClick={() => handleUpdateStatus(selectedProfile.id, 'rejected')}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle size={16} /> Suspendre l'accès
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}