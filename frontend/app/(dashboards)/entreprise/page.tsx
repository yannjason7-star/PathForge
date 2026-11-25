// À placer dans app/entreprise/page.tsx
// Page serveur minimale : toute la logique est dans le composant client EntrepriseDashboard
// (même principe que app/mentor/page.tsx).
import EntrepriseDashboard from "./entreprise-dashboard";

export default function Page() {
  return <EntrepriseDashboard />;
}
