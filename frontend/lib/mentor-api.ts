export type MentorDashboard = {
  mentor: { id: string; firstName: string | null; lastName: string | null };
  stats: {
    incubésSuivis: number;
    rendezVousSemaine: number;
    messagesNonLus: number;
  };
  prochainsRendezVous: Appointment[];
  alertes: Notification[];
};

export type Mentee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  projets: Project[];
  progression: { terminées: number; total: number; pourcentage: number };
};

export type Project = {
  id: string;
  incube_id: string;
  title: string;
  status: string | null;
};

export type Appointment = {
  id: string;
  incube_id: string;
  date_time: string;
  status: "pending" | "accepted" | "rejected" | string;
  meeting_url?: string | null;
};

export type Availability = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  time_zone: string;
  is_active: boolean;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type MentorMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export type Deliverable = {
  id: string;
  project_id: string;
  file_url: string | null;
  feedback_mentor: string | null;
  created_at: string;
};

export type MenteeDetail = {
  incubé: { id: string; first_name: string | null; last_name: string | null };
  projets: Project[];
  formations: { id: string; formation_id: string; is_completed: boolean; title: string | null }[];
  livrables: Deliverable[];
};

const apiUrl = (process.env.NEXT_PUBLIC_MENTOR_API_URL || "http://localhost:4000").replace(/\/$/, "");

export async function mentorApi<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/mentor${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("Impossible de joindre le backend. Vérifie qu’il tourne sur le port 4000.");
  }

  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || `Erreur API (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
