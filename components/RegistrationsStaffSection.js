"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RegistrationPrintTemplate from "@/components/registration/RegistrationPrintTemplate";

function formatDeDate(ymd) {
  if (!ymd || typeof ymd !== "string") return "—";
  try {
    const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });
  } catch {
    return ymd;
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function CopyBtn({ label, text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }
      }}
    >
      {done ? "✓" : label}
    </button>
  );
}

function FieldRow({ label, value, copyText }) {
  const display = value == null || value === "" ? "—" : String(value);
  const text = copyText != null ? String(copyText) : display === "—" ? "" : display;
  return (
    <div className="flex items-end justify-between gap-2 border-b border-slate-200/80 pb-2.5 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="whitespace-pre-wrap break-words text-sm font-bold text-slate-950">{display}</p>
      </div>
      {text ? <CopyBtn label="Kopieren" text={text} /> : null}
    </div>
  );
}

function extractNationality(r) {
  const direct = String(r?.nationality || "").trim();
  if (direct) return direct;
  const notes = String(r?.notes || "");
  const m = notes.match(/\[NATIONALITY\]\s*(.+)/i);
  if (m?.[1]) return String(m[1]).trim();
  return String(r?.country || "").trim();
}

function isSignatureRequired(nationalityRaw) {
  const value = String(nationalityRaw || "")
    .trim()
    .toLowerCase();
  if (!value) return false;
  const germanSet = new Set(["de", "deutsch", "deutschland", "german", "germany"]);
  return !germanSet.has(value);
}

function PrintBtn({ r, className = "", onPrint }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onPrint) onPrint(r);
      }}
      className={className}
    >
      Formular drucken
    </button>
  );
}

/** Reception clipboard: name, contact, plate, guest counts only — no dates, birth, address. */
function receptionDeskText(r) {
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
  return [
    `Name: ${name}`,
    `E-Mail: ${r.email ?? ""}`,
    `Telefon: ${r.phone ?? ""}`,
    `Kennzeichen: ${r.license_plate ?? ""}`,
    `Gäste — E: ${r.adults_count} · K: ${r.children_count} · Kl: ${r.infants_count} · Hunde: ${r.dogs_count}`
  ].join("\n");
}

function IntakeDetailModal({ r, onClose, onPurge, onPrint, busyId }) {
  if (!r) return null;

  const periodLine = `${formatDeDate(r.arrival_date)} → ${formatDeDate(r.departure_date)}`;
  const guestLine = `E ${r.adults_count} · K ${r.children_count} · Kl ${r.infants_count} · Hunde ${r.dogs_count}${
    r.other_pets_count > 0 ? ` · sonst. Tiere ${r.other_pets_count}` : ""
  }`;
  const nationality = extractNationality(r);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[1.5px] sm:items-center sm:p-5"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200/80 bg-slate-50 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.28)] sm:max-h-[90vh] sm:rounded-2xl sm:p-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-transparent"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(148,163,184,0.9) transparent" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Anmeldenummer</p>
            <p className="text-4xl font-black tabular-nums leading-none text-slate-900">#{r.registration_number}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Schließen
          </button>
        </div>

        <div className="mt-5 space-y-3.5">
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Aufenthalt</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{periodLine}</p>
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm space-y-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Gäste</p>
            <FieldRow label="Erwachsene" value={r.adults_count} />
            <FieldRow label="Kinder" value={r.children_count} />
            <FieldRow label="Kleinkinder" value={r.infants_count} />
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm space-y-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Person</p>
            <FieldRow label="Nachname" value={r.last_name} copyText={r.last_name || ""} />
            <FieldRow label="Vorname" value={r.first_name} copyText={r.first_name || ""} />
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm space-y-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Kontakt</p>
            <FieldRow label="E-Mail" value={r.email} copyText={r.email || ""} />
            <FieldRow label="Telefon" value={r.phone} copyText={r.phone || ""} />
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm space-y-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Fahrzeug</p>
            <FieldRow label="Kfz-Kennzeichen" value={r.license_plate} copyText={r.license_plate || ""} />
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm space-y-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Identität</p>
            <FieldRow label="Geburtsdatum" value={r.birth_date ? formatDeDate(r.birth_date) : "—"} />
            <FieldRow label="Land" value={r.country} copyText={r.country || ""} />
            <FieldRow label="Staatsangehörigkeit" value={nationality} copyText={nationality} />
          </section>
          <section className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm space-y-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">Adresse</p>
            <FieldRow label="Straße" value={r.street} copyText={r.street || ""} />
            <FieldRow label="PLZ" value={r.postcode} copyText={r.postcode || ""} />
            <FieldRow label="Ort" value={r.city} copyText={r.city || ""} />
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <PrintBtn r={r} onPrint={onPrint} className="fb-btn-secondary flex-1 border-slate-300 bg-white font-semibold text-slate-900" />
          <button
            type="button"
            disabled={busyId === r.id}
            className="fb-btn-secondary flex-1 border-emerald-200 bg-emerald-50 font-semibold text-emerald-950"
            onClick={() => onPurge(r.id)}
          >
            {busyId === r.id ? "…" : "Erledigt & Daten löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsDetailModal({ r, onClose }) {
  if (!r) return null;

  const lines = [
    `Anmeldenummer: ${r.registration_number}`,
    `Anreise: ${r.arrival_date}`,
    `Abreise: ${r.departure_date}`,
    `Übernachtungen: ${r.stay_nights}`,
    r.country ? `Land: ${r.country}` : null,
    `Erw./Kind./Kl.: ${r.adults_count}/${r.children_count}/${r.infants_count}`,
    `Tiere (Hunde/sonst.): ${r.dogs_count}/${r.other_pets_count}`,
    `Fahrzeug angegeben: ${r.has_vehicle ? "ja" : "nein"}`,
    `E-Mail angegeben: ${r.has_email ? "ja" : "nein"}`,
    `Telefon angegeben: ${r.has_phone ? "ja" : "nein"}`,
    `Frühstück bestellt: ${r.breakfast_ordered ? "ja" : "nein"}`,
    `Bearbeitet: ${r.processed_at ? new Date(r.processed_at).toLocaleString("de-DE") : "—"}`
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Archiv (ohne Personendaten)</p>
            <p className="text-3xl font-black tabular-nums text-slate-900">#{r.registration_number}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            Schließen
          </button>
        </div>

        <div className="mt-6 space-y-3 text-sm text-slate-800">
          <p>
            <span className="fb-label">Anreise / Abreise</span>
            <br />
            {formatDeDate(r.arrival_date)} → {formatDeDate(r.departure_date)} ({r.stay_nights} N.)
          </p>
          <p>
            <span className="fb-label">Land</span>
            <br />
            {r.country || "—"}
          </p>
          <p>
            <span className="fb-label">Gäste</span>
            <br />
            E {r.adults_count} · K {r.children_count} · Kl. {r.infants_count}
          </p>
          <p>
            <span className="fb-label">Kennungen</span>
            <br />
            Fahrzeug: {r.has_vehicle ? "ja" : "nein"} · Tel. angegeben: {r.has_phone ? "ja" : "nein"} · E-Mail angegeben:{" "}
            {r.has_email ? "ja" : "nein"}
          </p>
          <p>
            <span className="fb-label">Frühstück (Tracking)</span>
            <br />
            {r.breakfast_ordered ? "Ja" : "Nein"}
          </p>
        </div>

        <div className="mt-6">
          <button type="button" className="fb-btn-primary w-full" onClick={() => copyToClipboard(lines.join("\n"))}>
            Alles kopieren
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationsStaffSection({ apiPrefix }) {
  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [searchNum, setSearchNum] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [printRow, setPrintRow] = useState(null);
  const printInFlightRef = useRef(false);
  const previousTitleRef = useRef("");

  function printRegistrationForm(row) {
    if (printInFlightRef.current) return;
    printInFlightRef.current = true;
    previousTitleRef.current = document.title;
    document.title = " ";
    setPrintRow(row);
    setTimeout(() => window.print(), 40);
  }

  const load = useCallback(async ({ silent = false } = {}) => {
    setErr("");
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/registrations`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Laden fehlgeschlagen.");
      setPending(data.pending || []);
      setCompleted(data.completed || []);
    } catch (e) {
      setErr(String(e.message || e));
      setPending([]);
      setCompleted([]);
    }
    if (!silent) setLoading(false);
  }, [apiPrefix]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      load({ silent: true });
    }, 7000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!printRow) return;
    const done = () => {
      setPrintRow(null);
      if (previousTitleRef.current) document.title = previousTitleRef.current;
      printInFlightRef.current = false;
    };
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, [printRow]);

  const { filteredPending, filteredCompleted } = useMemo(() => {
    const num = searchNum.trim();
    const numOk = num && /^\d+$/.test(num);
    let p = pending;
    let c = completed;
    if (numOk) {
      p = p.filter((r) => String(r.registration_number ?? "").startsWith(num));
      c = c.filter((r) => String(r.registration_number ?? "").startsWith(num));
    }
    if (arrivalFilter) {
      p = p.filter((r) => r.arrival_date === arrivalFilter);
      c = c.filter((r) => r.arrival_date === arrivalFilter);
    }
    return { filteredPending: p, filteredCompleted: c };
  }, [pending, completed, searchNum, arrivalFilter]);

  async function purgeIntake(id) {
    setBusyId(id);
    setErr("");
    try {
      const res = await fetch(`${apiPrefix}/registrations/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Löschen fehlgeschlagen.");
      await load();
    } catch (e) {
      setErr(String(e.message || e));
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-200/80 bg-white p-4 shadow-md ring-1 ring-slate-200/90 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold leading-snug text-slate-900">Gäste-Anmeldungen</h2>
          <p className="mt-1 text-xs text-slate-500">Nr. an der Rezeption · vollständige Daten nur hier · nur dieser Standort</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200"
        >
          Aktualisieren
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="fb-label" htmlFor="reg-search-num">
            Nummer suchen
          </label>
          <input
            id="reg-search-num"
            inputMode="numeric"
            className="fb-input"
            placeholder="z. B. 42"
            value={searchNum}
            onChange={(e) => setSearchNum(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div>
          <label className="fb-label" htmlFor="reg-search-arrival">
            Anreise (Filter)
          </label>
          <input
            id="reg-search-arrival"
            type="date"
            className="fb-input"
            value={arrivalFilter}
            onChange={(e) => setArrivalFilter(e.target.value)}
          />
        </div>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-500">Lädt…</p> : null}
      {err ? <div className="fb-alert-error mt-3">{err}</div> : null}

      {!loading && filteredPending.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Keine Treffer
          {pending.length ? " (Filter)" : ""}.
        </p>
      ) : null}

      {filteredPending.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Offen (mit Personendaten)</p>
          <ul className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {filteredPending.map((r) => (
              <li key={r.id}>
                {(() => {
                  const signatureRequired = isSignatureRequired(extractNationality(r));
                  return (
                    <div
                      className={`flex min-h-[214px] w-full flex-col rounded-2xl border px-4 py-4 shadow-sm ring-1 transition sm:px-5 sm:py-4 ${
                        signatureRequired
                          ? "border-rose-200 bg-rose-50/45 ring-rose-100"
                          : "border-slate-200/90 bg-white ring-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="text-base font-black tabular-nums leading-none tracking-tight text-amber-950">#{r.registration_number ?? "—"}</p>
                        </div>
                        <div className="flex min-h-8 shrink-0 items-start justify-end gap-1.5">
                          {signatureRequired ? (
                            <PrintBtn
                              r={r}
                              onPrint={printRegistrationForm}
                              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => purgeIntake(r.id)}
                            disabled={busyId === r.id}
                            className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-2.5 text-[11px] font-bold text-white disabled:opacity-50"
                          >
                            {busyId === r.id ? "…" : "Erledigt & löschen"}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mt-3 flex min-h-0 flex-1 flex-col text-left"
                        onClick={() => setDetail({ kind: "intake", row: r })}
                      >
                        <p className="break-words text-[18px] font-bold leading-tight text-slate-900">
                          {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">
                          {formatDeDate(r.arrival_date)} <span className="text-slate-400">→</span> {formatDeDate(r.departure_date)}
                        </p>
                        <p className="mt-1.5 text-xs font-medium text-slate-500">
                          E {r.adults_count} · K {r.children_count} · Kl. {r.infants_count}
                        </p>
                        <p className="mt-auto pt-3 text-[11px] text-slate-400">Tippen für Details · Kopieren</p>
                      </button>
                    </div>
                  );
                })()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail?.kind === "intake" ? (
        <IntakeDetailModal
          r={detail.row}
          onClose={() => setDetail(null)}
          onPrint={printRegistrationForm}
          onPurge={async (id) => {
            try {
              await purgeIntake(id);
              setDetail(null);
            } catch {
              /* offen lassen */
            }
          }}
          busyId={busyId}
        />
      ) : null}
      {detail?.kind === "analytics" ? (
        <AnalyticsDetailModal r={detail.row} onClose={() => setDetail(null)} />
      ) : null}
      {printRow ? <RegistrationPrintTemplate registration={printRow} /> : null}
    </section>
  );
}
