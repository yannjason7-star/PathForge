"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Circle } from "lucide-react";

type Task = { id: string; title: string; is_completed: boolean };

// C'EST CETTE LIGNE QUI FAIT LE LIEN AVEC page.tsx :
export default function ChecklistWidget({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = async (id: string, currentStatus: boolean) => {
    // Mise à jour visuelle instantanée
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !currentStatus } : t));

    // Sauvegarde réelle dans Supabase
    await supabase.from('tasks').update({ is_completed: !currentStatus }).eq('id', id);
  };

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="bg-white p-6 rounded-2xl border border-[#e7edf3] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-sm font-bold text-[#758396] uppercase tracking-wider mb-1">Checklist de la semaine</h2>
          <p className="text-xl font-bold text-[#081e2c]">Vos objectifs</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-[#087f71]">{progress}%</span>
        </div>
      </div>

      <div className="w-full bg-[#f4f6fb] rounded-full h-2 mb-6">
        <div className="bg-[#087f71] h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="flex-1 space-y-3">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => toggleTask(task.id, task.is_completed)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              task.is_completed ? "bg-[#f4f6fb] border-transparent" : "bg-white border-[#e7edf3] hover:border-[#087f71]"
            }`}
          >
            {task.is_completed ? <CheckCircle2 size={20} className="text-[#087f71] flex-shrink-0" /> : <Circle size={20} className="text-[#e7edf3] flex-shrink-0" />}
            <span className={`text-sm font-medium ${task.is_completed ? "text-[#758396] line-through" : "text-[#081e2c]"}`}>
              {task.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}