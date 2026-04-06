"use client";

import { useState } from "react";

export default function RootChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk(false);
    if (newPassword !== confirmPassword) {
      setErr("Neue Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/internal/root/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Passwort konnte nicht geändert werden.");
        setLoading(false);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOk(true);
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
    setLoading(false);
  }

  return (
    <section className="fb-card">
      <h2 className="text-sm font-bold text-slate-900">Root-Passwort ändern</h2>
      <p className="mt-1 text-xs text-slate-500">
        Aktuelles Passwort bestätigen; neues Passwort wird mit bcrypt gespeichert.
      </p>
      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-4">
        <div>
          <label className="fb-label" htmlFor="root-cp-current">
            Aktuelles Passwort
          </label>
          <input
            id="root-cp-current"
            type="password"
            autoComplete="current-password"
            className="fb-input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="fb-label" htmlFor="root-cp-new">
            Neues Passwort (min. 8 Zeichen)
          </label>
          <input
            id="root-cp-new"
            type="password"
            autoComplete="new-password"
            className="fb-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="fb-label" htmlFor="root-cp-confirm">
            Neues Passwort wiederholen
          </label>
          <input
            id="root-cp-confirm"
            type="password"
            autoComplete="new-password"
            className="fb-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {err ? <p className="fb-alert-error">{err}</p> : null}
        {ok ? <p className="fb-alert-success">Passwort wurde geändert.</p> : null}
        <button type="submit" disabled={loading} className="fb-btn-primary">
          {loading ? "…" : "Passwort speichern"}
        </button>
      </form>
    </section>
  );
}
