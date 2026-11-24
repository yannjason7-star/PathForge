import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import { 
  Users, 
  Target, 
  Clock, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  UserCheck, 
  BookOpen, 
  Building2 
} from "lucide-react";
import Link from "next/link";

export const instant = false;

export default async function AdminDashboardPage() {
  await connection();

  // 1. Requêtes parallèles vers Supabase pour les KPIs et le KYC
  const [profilesRes, projectsRes, deliverablesRes, invoicesRes, pendingProfilesRes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }).in("status", ["en_dev", "lance"]),
    supabase.from("deliverables").select("*", { count: "exact", head: true }).eq("status", "en_attente"),
    supabase.from("invoices").select("amount, status"),
    supabase.from("profiles")
      .select("id, first_name, last_name, email, role, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  // 2. Traitement des données statistiques
  const totalUsers = profilesRes.count || 0;
  const activeProjects = projectsRes.count || 0;
  const pendingDeliverables = deliverablesRes.count || 0;

  // Calcul du CA Potentiel (somme des montants de devis)
  const potentialRevenue = (invoicesRes.data || []).reduce((acc, curr) => {
    return acc + (Number(curr.amount) || 0);
  }, 0);

  const pendingUsers = pendingProfilesRes.data || [];

  return (
    <div className="space-y-8 pb-10">
      
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Tour de Contrôle</h1>
        <p className="text-[#758396] text-sm font-medium">
          Surveillance globale de l'activité, validation KYC et indicateurs clés de PathForge.
        </p>
      </div>

      {/* LIGNE 1 : Les 4 Cartes KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1 : Inscrits Totaux */}
        <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#758396] uppercase tracking-wider">Inscrits Totaux</span>
            <div className="w-9 h-9 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[#081e2c]">{totalUsers}</p>
            <p className="text-xs text-[#758396] mt-1 font-medium">Tous rôles confondus</p>
          </div>
        </div>

        {/* KPI 2 : Projets Actifs */}
        <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#758396] uppercase tracking-wider">Projets Actifs</span>
            <div className="w-9 h-9 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center">
              <Target size={18} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[#081e2c]">{activeProjects}</p>
            <p className="text-xs text-[#087f71] mt-1 font-semibold">En dev ou lancés</p>
          </div>
        </div>

        {/* KPI 3 : Livrables en attente */}
        <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#758396] uppercase tracking-wider">Livrables en attente</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#c5a059] flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[#081e2c]">{pendingDeliverables}</p>
            <p className="text-xs text-[#758396] mt-1 font-medium">À évaluer par les mentors</p>
          </div>
        </div>

        {/* KPI 4 : CA Potentiel */}
        <div className="bg-[#081e2c] p-6 rounded-2xl border border-[#172538] shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-[#758396] uppercase tracking-wider">CA Prévisionnel</span>
            <div className="w-9 h-9 rounded-xl bg-[#172538] text-[#c5a059] flex items-center justify-center">
              <Coins size={18} />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">
              {potentialRevenue.toLocaleString('fr-FR')} €
            </p>
            <p className="text-xs text-[#c5a059] mt-1 font-semibold">Devis entreprises émis</p>
          </div>
        </div>

      </div>

      {/* LIGNE 2 : Bloc d'Alerte Urgente KYC (Comptes en attente de validation) */}
      <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#081e2c]">Comptes en attente de validation (KYC)</h2>
              {pendingUsers.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                  {pendingUsers.length} en attente
                </span>
              )}
            </div>
            <p className="text-xs text-[#758396] mt-1 font-medium">
              Vérifiez les identités et activez les comptes pour leur donner accès à la plateforme.
            </p>
          </div>

          <Link 
            href="/admin/utilisateurs" 
            className="text-xs font-bold text-[#087f71] hover:text-[#066459] flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            Gérer tous les utilisateurs <ChevronRight size={14} />
          </Link>
        </div>

        {/* Contenu KYC */}
        {pendingUsers.length === 0 ? (
          <div className="bg-[#f4f6fb] border border-[#e7edf3] rounded-xl p-6 flex items-center gap-4 text-emerald-800">
            <CheckCircle2 size={24} className="text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#081e2c]">Tous les comptes sont validés</p>
              <p className="text-xs text-[#758396] mt-0.5">Aucun nouvel utilisateur n'est bloqué dans le sas de sécurité.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#e7edf3] border border-[#e7edf3] rounded-xl overflow-hidden">
            {pendingUsers.map((user) => (
              <div key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#f4f6fb] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-bold flex items-center justify-center text-xs">
                    {(user.first_name?.[0] || 'U')}{(user.last_name?.[0] || '')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#081e2c]">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-[#758396]">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className="px-2.5 py-1 rounded bg-[#e7edf3] text-[#081e2c] text-[10px] font-bold uppercase tracking-wider">
                    {user.role}
                  </span>
                  <Link
                    href={`/admin/utilisateurs?focus=${user.id}`}
                    className="bg-[#087f71] hover:bg-[#066459] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    Examiner <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIGNE 3 : Raccourcis d'Actions Rapides */}
      <div>
        <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider mb-4">Raccourcis de Gestion</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          
          <Link 
            href="/admin/matching"
            className="bg-white p-5 rounded-2xl border border-[#e7edf3] hover:border-[#087f71] transition-all shadow-sm flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center group-hover:bg-[#087f71] group-hover:text-white transition-colors">
              <UserCheck size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#081e2c] group-hover:text-[#087f71] transition-colors">Matching Mentorat</p>
              <p className="text-xs text-[#758396] mt-0.5">Assigner des binômes Incubé-Mentor</p>
            </div>
          </Link>

          <Link 
            href="/admin/formations"
            className="bg-white p-5 rounded-2xl border border-[#e7edf3] hover:border-[#087f71] transition-all shadow-sm flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center group-hover:bg-[#081e2c] group-hover:text-white transition-colors">
              <BookOpen size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#081e2c] group-hover:text-[#087f71] transition-colors">Catalogue Formations</p>
              <p className="text-xs text-[#758396] mt-0.5">Publier des vidéos et quiz</p>
            </div>
          </Link>

          <Link 
            href="/admin/entreprises"
            className="bg-white p-5 rounded-2xl border border-[#e7edf3] hover:border-[#087f71] transition-all shadow-sm flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#f4f6fb] text-[#c5a059] flex items-center justify-center group-hover:bg-[#c5a059] group-hover:text-white transition-colors">
              <Building2 size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#081e2c] group-hover:text-[#087f71] transition-colors">Devis & Facturation</p>
              <p className="text-xs text-[#758396] mt-0.5">Gérer les demandes B2B</p>
            </div>
          </Link>

        </div>
      </div>

    </div>
  );
}