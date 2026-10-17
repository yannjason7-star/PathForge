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
            {/* Le vrai tableau visuel */}
      <div className="overflow-x-auto bg-white shadow-md rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="p-4 border-b">Nom & Prénom</th>
              <th className="p-4 border-b">Rôle</th>
              <th className="p-4 border-b">Statut</th>
              <th className="p-4 border-b">Email</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 border-b">
                <td className="p-4 font-medium">{user.first_name} {user.last_name}</td>
                <td className="p-4 capitalize text-blue-600">{user.role}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="p-4 text-gray-500">{user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}