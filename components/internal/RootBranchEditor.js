"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RootBranchDangerZone from "@/components/internal/RootBranchDangerZone";

const field = "fb-input";

export default function RootBranchEditor({ branchId, initialBranch, initialCredentials, dangerStats }) {
  const router = useRouter();
  const [name, setName] = useState(initialBranch.name);
  const [slug, setSlug] = useState(initialBranch.slug);
  const [isActive, setIsActive] = useState(initialBranch.is_active);
  const [branchErr, setBranchErr] = useState("");
  const [branchLoading, setBranchLoading] = useState(false);

  const [creds, setCreds] = useState(initialCredentials);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("team");
  const [addErr, setAddErr] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  async function saveBranch(e) {
    e.preventDefault();
    setBranchErr("");
    setBranchLoading(true);
    try {
      const res = await fetch(`/api/internal/root/branches/${branchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), is_active: isActive })
      });
      const data = await res.json();
      if (!res.ok) {
        setBranchErr(data.error || "Speichern fehlgeschlagen.");
        setBranchLoading(false);
        return;
      }
      if (data.branch?.slug) setSlug(data.branch.slug);
      router.refresh();
    } catch (ex) {
      setBranchErr(String(ex.message || ex));
    }
    setBranchLoading(false);
  }

  async function addCredential(e) {
    e.preventDefault();
    setAddErr("");
    setAddLoading(true);
    try {
      const res = await fetch(`/api/internal/root/branches/${branchId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: newUser.trim(), password: newPass, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        setAddErr(data.error || "Anlegen fehlgeschlagen.");
        setAddLoading(false);
        return;
      }
      setNewUser("");
      setNewPass("");
      setCreds((prev) => [...prev, data.credential].sort((a, b) => a.username.localeCompare(b.username)));
      router.refresh();
    } catch (ex) {
      setAddErr(String(ex.message || ex));
    }
    setAddLoading(false);
  }

  async function patchCredential(id, body) {
    const res = await fetch(`/api/internal/root/credentials/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update fehlgeschlagen.");
    return data.credential;
  }

  return (
    <div className="space-y-10">
      <p>
        <Link href="/internal/root/branches" className="text-sm font-medium text-amber-800 hover:underline">
          ← Alle Standorte
        </Link>
      </p>

      {!isActive ? (
        <div className="fb-alert-warn">
          Dieser Standort ist <strong>deaktiviert</strong>: öffentliche Bestellseite und /b/…-Zugänge sind nicht erreichbar. Daten und
          Konten bleiben bestehen — aktivieren Sie den Standort wieder oder nutzen Sie den Gefahrenbereich unten.
        </div>
      ) : null}

      <section className="fb-card">
        <h2 className="text-sm font-bold text-slate-900">Standort</h2>
        <form onSubmit={saveBranch} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="ed-name">
              Name
            </label>
            <input id="ed-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="ed-slug">
              Slug
            </label>
            <input id="ed-slug" className={field} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Aktiv (Bestellseite und öffentliche Liste)
          </label>
          {branchErr ? <p className="fb-alert-error">{branchErr}</p> : null}
          <button type="submit" disabled={branchLoading} className="fb-btn-primary">
            {branchLoading ? "…" : "Speichern"}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Öffentliche Bestellseite:{" "}
          <Link href={`/b/${slug}`} className="text-amber-800 hover:underline">
            /b/{slug}
          </Link>
        </p>
      </section>

      <section className="fb-card">
        <h2 className="text-sm font-bold text-slate-900">Neues Team-/Admin-Konto</h2>
        <form onSubmit={addCredential} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Benutzername</label>
            <input
              className={field}
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Passwort</label>
            <input
              type="password"
              className={field}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Rolle</label>
            <select
              className={field}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="team">team</option>
              <option value="admin">admin</option>
            </select>
          </div>
          {addErr ? <p className="fb-alert-error sm:col-span-3">{addErr}</p> : null}
          <div className="sm:col-span-3">
            <button type="submit" disabled={addLoading} className="fb-btn-primary">
              {addLoading ? "…" : "Konto anlegen"}
            </button>
          </div>
        </form>
      </section>

      <section className="fb-card">
        <h2 className="text-sm font-bold text-slate-900">Konten dieses Standorts</h2>
        <ul className="mt-4 space-y-6">
          {creds.map((c) => (
            <CredentialRow
              key={c.id}
              initial={c}
              onUpdate={async (body) => {
                const updated = await patchCredential(c.id, body);
                setCreds((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                router.refresh();
              }}
            />
          ))}
        </ul>
        {!creds.length ? <div className="fb-empty">Noch keine Konten für diesen Standort.</div> : null}
      </section>

      {dangerStats ? (
        <RootBranchDangerZone
          branchId={branchId}
          branchName={name}
          slug={slug}
          isActive={isActive}
          onIsActiveChange={(next) => setIsActive(next)}
          stats={dangerStats}
        />
      ) : null}
    </div>
  );
}

function CredentialRow({ initial, onUpdate }) {
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial.role);
  const [isActive, setIsActive] = useState(initial.is_active);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUsername(initial.username);
    setRole(initial.role);
    setIsActive(initial.is_active);
  }, [initial.username, initial.role, initial.is_active, initial.id]);

  async function save(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const body = { username: username.trim(), role, is_active: isActive };
      if (password.length > 0) body.password = password;
      await onUpdate(body);
      setPassword("");
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
    setLoading(false);
  }

  return (
    <li className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Benutzername</label>
          <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Neues Passwort (optional)</label>
          <input
            type="password"
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="leer = unverändert"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Rolle</label>
          <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="team">team</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Aktiv
          </label>
          <button type="submit" disabled={loading} className="fb-btn-primary">
            {loading ? "…" : "Speichern"}
          </button>
        </div>
        {err ? <p className="fb-alert-error sm:col-span-2 lg:col-span-4">{err}</p> : null}
      </form>
    </li>
  );
}
