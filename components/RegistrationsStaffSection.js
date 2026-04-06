"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
      className="fb-btn-secondary shrink-0 px-2 py-1.5 text-xs"
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
    <div className="flex items-end justify-between gap-2 border-b border-slate-100 pb-3">
      <div className="min-w-0 flex-1">
        <p className="fb-label">{label}</p>
        <p className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{display}</p>
      </div>
      {text ? <CopyBtn label="Kopieren" text={text} /> : null}
    </div>
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

function IntakeDetailModal({ r, onClose, onPurge, busyId }) {
  if (!r) return null;

  const deskText = receptionDeskText(r);
  const periodLine = `${formatDeDate(r.arrival_date)} → ${formatDeDate(r.departure_date)}`;
  const guestLine = `E ${r.adults_count} · K ${r.children_count} · Kl ${r.infants_count} · Hunde ${r.dogs_count}${
    r.other_pets_count > 0 ? ` · sonst. Tiere ${r.other_pets_count}` : ""
  }`;

  const fullLines = [
    `Anmeldenummer: ${r.registration_number}`,
    `Anreise: ${r.arrival_date}`,
    `Abreise: ${r.departure_date}`,
    `Vorname: ${r.first_name}`,
    `Nachname: ${r.last_name}`,
    r.birth_date ? `Geburtsdatum: ${r.birth_date}` : null,
    r.country ? `Land: ${r.country}` : null,
    r.street ? `Straße: ${r.street}` : null,
    r.postcode ? `PLZ: ${r.postcode}` : null,
    r.city ? `Ort: ${r.city}` : null,
    r.id_number ? `Ausweis/Dokument: ${r.id_number}` : null,
    r.phone ? `Telefon: ${r.phone}` : null,
    r.email ? `E-Mail: ${r.email}` : null,
    r.license_plate ? `Kennzeichen: ${r.license_plate}` : null,
    `Erwachsene: ${r.adults_count}`,
    `Kinder: ${r.children_count}`,
    `Kleinkinder: ${r.infants_count}`,
    `Hunde: ${r.dogs_count}`,
    `Sonstige Tiere: ${r.other_pets_count}`,
    r.payment_method ? `Zahlungsart: ${r.payment_method}` : null,
    r.notes ? `Hinweise: ${r.notes}` : null,
    `Eingang: ${new Date(r.created_at).toLocaleString("de-DE")}`,
    r.expires_at ? `Löschung vorgesehen: ${new Date(r.expires_at).toLocaleString("de-DE")}` : null
  ].filter(Boolean);

  const fullText = fullLines.join("\n");

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
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Anmeldenummer</p>
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

        <div className="mt-5 rounded-2xl border-2 border-slate-200/90 bg-slate-50/95 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Aufenthalt</p>
          <p className="mt-2 text-lg font-bold leading-snug text-slate-900">{periodLine}</p>
          <div className="mt-4 space-y-0">
            <FieldRow label="Anreise" value={formatDeDate(r.arrival_date)} copyText={r.arrival_date} />
            <FieldRow label="Abreise" value={formatDeDate(r.departure_date)} copyText={r.departure_date} />
          </div>
          <div className="mt-2 border-t border-slate-200/80 pt-2">
            <FieldRow label="Gäste" value={guestLine} copyText={guestLine} />
          </div>
        </div>

        <div className="mt-5 space-y-0">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Person</p>
          <FieldRow label="Vorname" value={r.first_name} />
          <FieldRow label="Nachname" value={r.last_name} />
          <FieldRow label="Geburtsdatum" value={r.birth_date ? formatDeDate(r.birth_date) : "—"} copyText={r.birth_date || ""} />
        </div>

        <div className="mt-5 space-y-0 border-t border-slate-100 pt-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Kontakt</p>
          <FieldRow label="E-Mail" value={r.email} />
          <FieldRow label="Telefon" value={r.phone} />
          <FieldRow label="Kennzeichen" value={r.license_plate} />
        </div>

        <div className="mt-5 space-y-0 border-t border-slate-100 pt-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Weitere Angaben</p>
          <FieldRow label="Land" value={r.country} />
          <FieldRow label="Straße" value={r.street} />
          <FieldRow label="PLZ" value={r.postcode} />
          <FieldRow label="Ort" value={r.city} />
          <FieldRow label="Ausweis / Dokument" value={r.id_number} />
          <FieldRow label="Sonstige Tiere" value={r.other_pets_count} copyText={String(r.other_pets_count)} />
          <FieldRow label="Zahlungsart" value={r.payment_method} />
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="fb-label">Hinweise</p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{r.notes || "—"}</p>
              </div>
              {r.notes ? <CopyBtn label="Kopieren" text={r.notes} /> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border-2 border-amber-200/90 bg-amber-50/90 p-4 shadow-sm ring-1 ring-amber-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900/90">Empfangsdaten kopieren</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-950/75">
            Name, E-Mail, Telefon, Kennzeichen und Gästezahlen — ohne Aufenthalt, Geburtsdatum und Adresse.
          </p>
          <button
            type="button"
            className="fb-btn-primary mt-4 w-full py-3 text-sm font-bold shadow-sm"
            onClick={() => copyToClipboard(deskText)}
          >
            Empfangsdaten kopieren
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="fb-btn-primary flex-1" onClick={() => copyToClipboard(fullText)}>
            Vollständig kopieren
          </button>
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

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
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
    setLoading(false);
  }, [apiPrefix]);

  useEffect(() => {
    load();
  }, [load]);

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

      {!loading && filteredPending.length === 0 && filteredCompleted.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Keine Treffer
          {pending.length + completed.length ? " (Filter)" : ""}.
        </p>
      ) : null}

      {filteredPending.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Offen (mit Personendaten)</p>
          <ul className="mt-2 space-y-2">
            {filteredPending.map((r) => (
              <li key={r.id}>
                <div className="flex w-full flex-wrap items-start justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-left sm:px-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDetail({ kind: "intake", row: r })}
                  >
                    <p className="text-lg font-black tabular-nums text-amber-950">#{r.registration_number ?? "—"}</p>
                    <p className="font-semibold text-slate-900">
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                    </p>
                    <p className="mt-1 text-slate-700">
                      {formatDeDate(r.arrival_date)} → {formatDeDate(r.departure_date)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      E {r.adults_count} · K {r.children_count} · Kl. {r.infants_count}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">Tippen für Details · Kopieren</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => purgeIntake(r.id)}
                    disabled={busyId === r.id}
                    className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busyId === r.id ? "…" : "Erledigt & löschen"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {filteredCompleted.length > 0 ? (
        <div className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bearbeitet (nur Auswertungsdaten)</p>
          <ul className="mt-2 space-y-1.5 opacity-95">
            {filteredCompleted.slice(0, 40).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setDetail({ kind: "analytics", row: r })}
                  className="flex w-full flex-wrap justify-between gap-2 rounded-xl border border-transparent px-1 py-1.5 text-left text-xs text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                >
                  <span className="font-mono font-bold text-slate-800">#{r.registration_number ?? "—"}</span>
                  <span>
                    {formatDeDate(r.arrival_date)} · {r.stay_nights} N.
                  </span>
                  <span className="text-slate-400">{r.processed_at ? new Date(r.processed_at).toLocaleString("de-DE") : "—"}</span>
                </button>
              </li>
            ))}
            {filteredCompleted.length > 40 ? (
              <li className="text-[11px] text-slate-400">… und {filteredCompleted.length - 40} weitere</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {detail?.kind === "intake" ? (
        <IntakeDetailModal
          r={detail.row}
          onClose={() => setDetail(null)}
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
    </section>
  );
}
