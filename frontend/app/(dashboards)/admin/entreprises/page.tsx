import { supabase } from "@/lib/supabase";
import { connection } from "next/server";
import InvoiceManagerClient, { 
  InvoiceWithEntreprise, 
  EntrepriseProfile 
} from "@/components/admin/InvoiceManagerClient";

export const instant = false;

export default async function AdminEntreprisesPage() {
  await connection();

  // 1. Récupération parallèle des devis et des profils entreprises
  const [invoicesRes, entreprisesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, entreprise_id, amount, status, file_url, created_at, title")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "entreprise"),
  ]);

  const rawInvoices = invoicesRes.data || [];
  const entreprises: EntrepriseProfile[] = entreprisesRes.data || [];

  // 2. Assemblage en mémoire
  const assembledInvoices: InvoiceWithEntreprise[] = rawInvoices.map((inv) => {
    const entreprise = entreprises.find((e) => e.id === inv.entreprise_id) || null;
    return {
      ...inv,
      entreprise,
    };
  });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-[#081e2c] mb-2">Gestion Entreprises & Facturation</h1>
        <p className="text-[#758396] text-sm font-medium">
          Émettez des devis pour les entreprises clientes, suivez les signatures et gérez l'encaissement des prestations numériques.
        </p>
      </div>

      <InvoiceManagerClient 
        initialInvoices={assembledInvoices} 
        entreprisesList={entreprises} 
      />
    </div>
  );
}