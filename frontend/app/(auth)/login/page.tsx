"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { mentorApi } from "@/lib/mentor-api";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (loginError) throw loginError;
      if (!data.session) throw new Error("Supabase n’a pas renvoyé de session.");

      try {
        await mentorApi("/dashboard", data.session.access_token);
      } catch (accessError) {
        await supabase.auth.signOut();
        throw accessError;
      }
      router.replace("/mentor");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "La connexion a échoué.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link className="login-brand" href="/"><span className="brand-mark">PF</span><span><strong>PathForge</strong><small>MENTORAT & INCUBATION</small></span></Link>
        <div className="login-intro"><span className="login-kicker">ESPACE MENTOR</span><h1>Content de te revoir.</h1><p>Connecte-toi pour retrouver tes incubés, tes rendez-vous et leurs livrables.</p></div>
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="mentor-email">Adresse e-mail</label>
          <input id="mentor-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="camille@exemple.fr" required />
          <label htmlFor="mentor-password">Mot de passe</label>
          <input id="mentor-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ton mot de passe" required />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter →"}</button>
        </form>
        <p className="login-note">L’accès au cockpit est réservé aux comptes Mentor actifs.</p>
      </section>
      <aside className="login-aside"><div className="login-aside-content"><div className="login-orbit">PF</div><span className="login-kicker">FAIRE GRANDIR LES PROJETS</span><h2>Le bon accompagnement change tout.</h2><p>Un seul espace pour suivre la progression, donner du feedback et rester proche de chaque incubé.</p></div><div className="login-aside-footer">PathForge · Espace de mentorat</div></aside>
    </main>
  );
}
