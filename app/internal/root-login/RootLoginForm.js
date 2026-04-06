"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RootLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/internal/root/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Anmeldung fehlgeschlagen.");
        setLoading(false);
        return;
      }
      router.push("/internal/root");
      router.refresh();
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="fb-hero mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">System</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Root-Admin</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/90">Nur für den Betreiber — nicht für Standort-Teams.</p>
      </div>

      <div className="fb-card">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="fb-label" htmlFor="root-user">
              Benutzername
            </label>
            <input
              id="root-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="fb-input"
            />
          </div>
          <div>
            <label className="fb-label" htmlFor="root-pass">
              Passwort
            </label>
            <input
              id="root-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="fb-input"
            />
          </div>
          {err ? <p className="fb-alert-error">{err}</p> : null}
          <button type="submit" disabled={loading} className="fb-btn-primary w-full">
            {loading ? "…" : "Anmelden"}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm">
        <Link href="/" className="font-medium text-amber-800 underline-offset-2 hover:underline">
          Zur Startseite
        </Link>
      </p>
    </div>
  );
}
