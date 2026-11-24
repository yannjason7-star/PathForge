"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  BookOpen, 
  Building2, 
  Calendar,
  Bell,
  LogOut, 
  ShieldCheck 
} from "lucide-react";

const adminNavLinks = [
  { name: "Tour de contrôle", href: "/admin", icon: LayoutDashboard },
  { name: "Utilisateurs & KYC", href: "/admin/utilisateurs", icon: Users },
  { name: "Matching Incubation", href: "/admin/matching", icon: UserCheck },
  { name: "Suivi des Sessions", href: "/admin/sessions", icon: Calendar },
  { name: "Gestion Formations", href: "/admin/formations", icon: BookOpen },
  { name: "Entreprises & Devis", href: "/admin/entreprises", icon: Building2 },
  { name: "Notifications", href: "/admin/notifications", icon: Bell },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white flex flex-col h-screen fixed left-0 top-0 border-r border-[#e7edf3] z-20">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded bg-[#081e2c] flex items-center justify-center text-white">
            <ShieldCheck size={18} className="text-[#087f71]" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-[#081e2c] leading-none">PathForge</span>
            <span className="text-[9px] text-[#758396] font-semibold tracking-wider mt-1">ADMINISTRATION</span>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#081e2c] text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#087f71]"></span>
          Super Admin
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {adminNavLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#081e2c] text-white shadow-sm"
                  : "text-[#172538] hover:bg-[#f4f6fb]"
              }`}
            >
              <Icon size={18} className={isActive ? "text-[#087f71]" : "text-[#758396]"} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#e7edf3] bg-white">
        <button className="flex items-center gap-2 text-xs text-[#758396] hover:text-[#081e2c] transition-colors px-2">
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}