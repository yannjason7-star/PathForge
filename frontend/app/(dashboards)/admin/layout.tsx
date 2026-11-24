import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { supabase } from "@/lib/supabase";
import { connection } from "next/server";

export const instant = false;
const currentAdminId = "a0000000-0000-0000-0000-000000000000";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", currentAdminId)
    .single();

  const adminName = profile ? `${profile.first_name} ${profile.last_name}` : "Jason Admin";

  return (
    <div className="flex h-screen bg-[#f4f6fb] font-sans">
      <div className="hidden md:block w-64 flex-shrink-0">
        <AdminSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader adminName={adminName} adminId={currentAdminId} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}