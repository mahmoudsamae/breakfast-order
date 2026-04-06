"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function safeNextPath(raw, branchSlug) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const p = decodeURIComponent(raw.trim());
    const prefix = `/b/${branchSlug}/`;
    if (!p.startsWith(prefix)) return null;
    if (p.includes("//") || p.includes("..")) return null;
    return p;
  } catch {
    return null;
  }
}

export default function BranchLoginForm({ branchSlug, branchName }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextDefault = useMemo(() => safeNextPath(searchParams.get("next"), branchSlug), [searchParams, branchSlug]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`/api/branches/${branchSlug}/auth/login`, {
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
      const role = data.role;
      let dest = nextDefault;
      if (!dest) {
        dest = role === "admin" ? `/b/${branchSlug}/admin` : `/b/${branchSlug}/staff`;
      } else if (role === "team" && dest.includes("/admin")) {
        dest = `/b/${branchSlug}/staff`;
      } else if (role === "admin" && dest.includes("/staff") && !dest.includes("/admin")) {
        dest = `/b/${branchSlug}/admin`;
      }
      router.push(dest);
      router.refresh();
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="fb-hero mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Intern</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Anmeldung</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/90">
          {branchName ? <span>{branchName}</span> : <span>Standort</span>}
        </p>
      </div>

      <div className="fb-card">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="fb-label" htmlFor="fb-user">
              Benutzername
            </label>
            <input
              id="fb-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="fb-input"
            />
          </div>
          <div>
            <label className="fb-label" htmlFor="fb-pass">
              Passwort
            </label>
            <input
              id="fb-pass"
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
        <Link href={`/b/${branchSlug}`} className="font-medium text-amber-800 underline-offset-2 hover:underline">
          Zurück zum Standort
        </Link>
      </p>
    </div>
  );
}
