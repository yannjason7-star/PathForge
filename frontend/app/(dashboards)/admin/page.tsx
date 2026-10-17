import { supabase } from '@/lib/supabase';

// La NOUVELLE commande pour les versions récentes de Next.js
export const instant = false;

export default async function AdminPage() {
  // On demande à Supabase de nous donner tous les profils
  const { data: profiles, error } = await supabase.from('profiles').select('*');

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">Dashboard Admin</h1>
      
      {/* On vérifie si la connexion a marché */}
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <p className="font-semibold">
          Statut Supabase : {error ? '❌ Erreur de connexion' : '✅ Connexion réussie !'}
        </p>
      </div>

      <h2 className="text-xl font-bold mb-2">Utilisateurs dans la base de données :</h2>
      
      {/* On affiche les données brutes sous forme de texte */}
      <pre className="bg-slate-800 text-green-400 p-4 rounded-lg overflow-x-auto">
        {JSON.stringify(profiles, null, 2)}
      </pre>
    </div>
  );
}