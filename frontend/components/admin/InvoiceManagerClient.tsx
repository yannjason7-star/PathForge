"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Plus, 
  Coins, 
  FileText, 
  UploadCloud, 
  Search, 
  ExternalLink, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCheck
} from "lucide-react";

export type EntrepriseProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};

export type InvoiceWithEntreprise = {
  id: string;
  title: string | null;
  amount: number;
  status: string;
  file_url: string;
  created_at: string;
  entreprise_id: string;
  entreprise: EntrepriseProfile | null;
};

export default function InvoiceManagerClient({
  initialInvoices,
  entreprisesList,
}: {
  initialInvoices: InvoiceWithEntreprise[];
  entreprisesList: EntrepriseProfile[];
}) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithEntreprise[]>(initialInvoices);

  // Formulaire d'émission de devis
  const [selectedEntrepriseId, setSelectedEntrepriseId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("devis_envoye");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Recherche & Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Métriques financières
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const totalAmount = invoices.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const paidAmount = invoices
      .filter((i) => i.status === "paye")
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pendingCount = invoices.filter((i) => i.status !== "paye").length;

    return { totalCount, totalAmount, paidAmount, pendingCount };
  }, [invoices]);

  // Filtrage
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        (inv.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${inv.entreprise?.first_name || ""} ${inv.entreprise?.last_name || ""}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.entreprise?.email || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  // Émission d'un Devis / Facture
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntrepriseId || !amount || !file) {
      setErrorMsg("Veuillez sélectionner une entreprise, renseigner le montant et joindre le PDF.");
      return;
    }

    setIsUploading(true);
    setErrorMsg("");

    try {
      // 1. Upload vers le bucket "invoices"
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${selectedEntrepriseId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. URL Publique
      const { data: publicUrlData } = supabase.storage
        .from("invoices")
        .getPublicUrl(filePath);

      // 3. Insertion dans la table invoices
      const numericAmount = parseFloat(amount);
      const { data: inserted, error: dbError } = await supabase
        .from("invoices")
        .insert({
          entreprise_id: selectedEntrepriseId,
          title: title.trim() || "Prestation numérique",
          amount: numericAmount,
          status: status,
          file_url: publicUrlData.publicUrl,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const entreprise = entreprisesList.find((e) => e.id === selectedEntrepriseId) || null;

      // Mise à jour optimiste
      setInvoices([{ ...inserted, entreprise }, ...invoices]);

      // Réinitialisation
      setSelectedEntrepriseId("");
      setTitle("");
      setAmount("");
      setFile(null);
      router.refresh();
      alert("Devis émis et enregistré avec succès !");
    } catch (err: any) {
      console.error("Erreur émission devis:", err);
      setErrorMsg(`Erreur : ${err?.message || "Impossible d'enregistrer le devis."}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Mise à jour de statut (ex: Marquer comme Payé)
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setInvoices((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
      );
      router.refresh();
    } catch (err: any) {
      alert(`Erreur : ${err?.message || "Action impossible"}`);
    }
  };

  // Suppression d'un devis
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm("Voulez-vous supprimer ce document de facturation ?")) return;

    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;

      setInvoices((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    } catch (err: any) {
      alert(`Erreur : ${err?.message || "Action impossible"}`);
    }
  };

  return (
    <div className="space-y-8 pb-10">

      {/* 1. KPIs Financiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">CA Facturé Global</p>
            <p className="text-2xl font-bold text-[#081e2c] mt-1">
              {stats.totalAmount.toLocaleString("fr-FR")} €
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#f4f6fb] text-[#081e2c] flex items-center justify-center">
            <Coins size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Encaissé (Payé)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {stats.paidAmount.toLocaleString("fr-FR")} €
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Devis en attente</p>
            <p className="text-2xl font-bold text-[#c5a059] mt-1">{stats.pendingCount}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#c5a059] flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e7edf3] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#758396] uppercase tracking-wider">Entreprises Clientes</p>
            <p className="text-2xl font-bold text-[#087f71] mt-1">{entreprisesList.length}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#e6f2f1] text-[#087f71] flex items-center justify-center">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {/* 2. Zone Principale (Formulaire Émission + Tableau de bord) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Formulaire d'Émission de Devis */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm sticky top-28">
          <div className="flex items-center gap-2 mb-6 text-[#081e2c]">
            <Plus size={20} className="text-[#087f71]" />
            <h2 className="text-lg font-bold">Émettre un devis / facture</h2>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            
            {/* Sélection Entreprise */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                Entreprise destinataire
              </label>
              {entreprisesList.length === 0 ? (
                <p className="text-xs text-orange-600 font-medium">
                  Aucune entreprise enregistrée dans la table profiles.
                </p>
              ) : (
                <select
                  value={selectedEntrepriseId}
                  onChange={(e) => setSelectedEntrepriseId(e.target.value)}
                  required
                  className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
                >
                  <option value="">Sélectionner une entreprise...</option>
                  {entreprisesList.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.first_name} {ent.last_name} ({ent.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Objet du projet */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                Objet de la prestation
              </label>
              <input
                type="text"
                placeholder="Ex: Refonte application mobile MVP"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
              />
            </div>

            {/* Montant (€) */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                Montant total (€)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 4500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
              />
            </div>

            {/* Statut initial */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                Statut initial
              </label>
             <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#f4f6fb] border border-[#e7edf3] rounded-xl px-4 py-2.5 text-sm text-[#081e2c] focus:outline-none focus:border-[#087f71]"
              >
                <option value="devis_envoye">Devis envoyé</option>
                <option value="a_payer">À payer</option>
                <option value="paye">Déjà payé</option>
              </select>
            </div>

            {/* Upload PDF */}
            <div>
              <label className="block text-xs font-bold text-[#758396] uppercase tracking-wider mb-2">
                Document PDF officiel
              </label>
              <div className="border-2 border-dashed border-[#e7edf3] rounded-xl p-4 text-center bg-[#f4f6fb] hover:border-[#087f71] transition-colors">
                <UploadCloud size={24} className="mx-auto text-[#087f71] mb-1.5" />
                <input
                  type="file"
                  id="invoice-file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="invoice-file"
                  className="cursor-pointer text-xs font-bold text-[#081e2c] hover:text-[#087f71] inline-block"
                >
                  {file ? file.name : "Sélectionner le devis PDF"}
                </label>
              </div>
            </div>

            {errorMsg && <p className="text-xs text-red-500 font-medium">{errorMsg}</p>}

            <button
              type="submit"
              disabled={isUploading || !selectedEntrepriseId || !amount || !file}
              className="w-full bg-[#081e2c] hover:bg-[#172538] text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isUploading ? "Enregistrement..." : "Transmettre le devis"}
            </button>
          </form>
        </div>

        {/* Historique et Gestion des Devis (Colonne Droite) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Recherche & Filtres */}
          <div className="bg-white p-4 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center px-3 py-2 bg-[#f4f6fb] rounded-xl border border-[#e7edf3] w-full sm:max-w-xs focus-within:bg-white focus-within:border-[#087f71] transition-all">
              <Search size={16} className="text-[#758396] mr-2" />
              <input
                type="text"
                placeholder="Rechercher un devis, client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-[#081e2c] placeholder:text-[#758396]"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
             {[
                { id: "all", label: "Tous" },
                { id: "devis_envoye", label: "Envoyés" },
                { id: "a_payer", label: "À payer" },
                { id: "paye", label: "Payés" },
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

          {/* Table des Factures / Devis */}
          <div className="bg-white rounded-2xl border border-[#e7edf3] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f4f6fb] text-[#758396] uppercase text-[10px] font-bold tracking-wider border-b border-[#e7edf3]">
                  <tr>
                    <th className="px-6 py-4">Prestation & Client</th>
                    <th className="px-6 py-4">Montant</th>
                    <th className="px-6 py-4">Statut</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7edf3]">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[#758396]">
                        Aucun devis ou facture émis pour le moment.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isPaid = inv.status === "paye";

                      return (
                        <tr key={inv.id} className="hover:bg-[#f4f6fb]/60 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-[#081e2c]">{inv.title || "Prestation PathForge"}</p>
                            <p className="text-xs text-[#758396] mt-0.5">
                              Client : {inv.entreprise ? `${inv.entreprise.first_name} ${inv.entreprise.last_name}` : "Entreprise"}
                            </p>
                          </td>

                          <td className="px-6 py-4 font-bold text-[#081e2c]">
                            {Number(inv.amount).toLocaleString("fr-FR")} €
                          </td>

                          <td className="px-6 py-4">
                            {inv.status === "paye" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle2 size={12} /> Payé
                              </span>
                            ) : inv.status === "a_payer" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                                <Clock size={12} /> À payer
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                                <Clock size={12} /> Devis envoyé
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {inv.file_url && (
                                <a
                                  href={inv.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-[#758396] hover:text-[#087f71] hover:bg-[#e6f2f1] rounded-lg transition-colors"
                                  title="Télécharger le PDF"
                                >
                                  <ExternalLink size={18} />
                                </a>
                              )}

                              {!isPaid && (
                                <button
                                  onClick={() => handleStatusChange(inv.id, "paye")}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                  title="Marquer comme payé"
                                >
                                  Encaissé
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteInvoice(inv.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
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

        </div>

      </div>
    </div>
  );
}