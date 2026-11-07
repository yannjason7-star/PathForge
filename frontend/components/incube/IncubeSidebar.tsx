"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, FolderKanban, Calendar, MessageSquare, LogOut } from "lucide-react";

const navLinks = [
  { name: "Vue d'ensemble", href: "/incube", icon: LayoutDashboard },
  { name: "Formations", href: "/incube/formations", icon: BookOpen },
  { name: "Mon Projet", href: "/incube/projet", icon: FolderKanban },
  { name: "Mentorat", href: "/incube/mentorat", icon: Calendar },
  { name: "Messagerie", href: "/incube/messagerie", icon: MessageSquare },
];

export default function IncubeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white flex flex-col h-screen fixed left-0 top-0 border-r border-[#e7edf3] z-20">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded bg-[#087f71] flex items-center justify-center">
            <span className="font-bold text-white text-sm">PF</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-[#081e2c] leading-none">PathForge</span>
            <span className="text-[9px] text-[#758396] font-semibold tracking-wider mt-1">PLATEFORME SAAS</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-[#758396] uppercase tracking-widest mb-3">
          Espace Incubé
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navLinks.map((link) => {
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
              <Icon size={18} className={isActive ? "text-white" : "text-[#758396]"} />
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