"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  clearRegistrationDraft,
  readRegistrationDraft,
  writeRegistrationDraft
} from "@/lib/registration-form-storage";
import { writeRegistrationNumberSession } from "@/lib/registration-session";

const defaultDraft = () => ({
  arrival_date: "",
  departure_date: "",
  adults_count: 2,
  children_count: 0,
  infants_count: 0,
  dogs_count: 0,
  other_pets_count: 0,
  first_name: "",
  last_name: "",
  birth_date: "",
  nationality: "",
  country: "",
  street: "",
  postcode: "",
  city: "",
  id_number: "",
  phone: "",
  email: "",
  license_plate: "",
  payment_method: "",
  notes: ""
});

const COUNTRY_OPTIONS = [
  "Deutschland",
  "Österreich",
  "Schweiz",
  "Niederlande",
  "Belgien",
  "Frankreich",
  "Italien",
  "Spanien",
  "Polen",
  "Tschechien",
  "Rumänien",
  "Ungarn",
  "Slowakei",
  "Slowenien",
  "Kroatien",
  "Serbien",
  "Bosnien und Herzegowina",
  "Griechenland",
  "Türkei",
  "Ukraine",
  "Syrien",
  "Irak",
  "Afghanistan",
  "Iran",
  "USA",
  "Vereinigtes Königreich"
];

const COUNTRY_TO_NATIONALITY = {
  deutschland: "Deutsch",
  österreich: "Österreichisch",
  schweiz: "Schweizerisch",
  niederlande: "Niederländisch",
  belgien: "Belgisch",
  frankreich: "Französisch",
  italien: "Italienisch",
  spanien: "Spanisch",
  polen: "Polnisch",
  tschechien: "Tschechisch",
  rumänien: "Rumänisch",
  ungarn: "Ungarisch",
  slowakei: "Slowakisch",
  slowenien: "Slowenisch",
  kroatien: "Kroatisch",
  serbien: "Serbisch",
  "bosnien und herzegowina": "Bosnisch",
  griechenland: "Griechisch",
  türkei: "Türkisch",
  ukraine: "Ukrainisch",
  syrien: "Syrisch",
  irak: "Irakisch",
  afghanistan: "Afghanisch",
  iran: "Iranisch",
  usa: "Amerikanisch",
  "vereinigte staaten": "Amerikanisch",
  "vereinigtes königreich": "Britisch"
};

function nationalityFromCountry(country) {
  const k = String(country || "").trim().toLowerCase();
  if (!k) return "";
  return COUNTRY_TO_NATIONALITY[k] || String(country || "").trim();
}

/** Reception-focused contact fields */
const keyInputClass =
  "fb-input border-2 border-amber-300/80 bg-amber-50/60 shadow-sm focus:border-amber-500 focus:ring-amber-200/50";

/** Person name + birth */
const personInputClass =
  "fb-input border-2 border-slate-300/90 bg-white shadow-sm focus:border-amber-500 focus:ring-amber-100/80";

function isYmd(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function FormSection({ title, hint, highlight, children }) {
  return (
    <section
      className={
        highlight
          ? "space-y-4 rounded-2xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-white p-4 shadow-sm ring-1 ring-amber-100/80 sm:p-5"
          : "space-y-4 border-b border-slate-100 pb-6 last:border-b-0 last:pb-0"
      }
    >
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function RegisterClient({ branchSlug, branchName }) {
  const [form, setForm] = useState(defaultDraft);
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [ok, setOk] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const d = readRegistrationDraft(branchSlug);
    if (d && typeof d === "object") {
      const base = defaultDraft();
      const merged = { ...base };
      for (const k of Object.keys(base)) {
        if (Object.prototype.hasOwnProperty.call(d, k)) merged[k] = d[k];
      }
      setForm(merged);
    }
    setRestored(true);
  }, [branchSlug]);

  useEffect(() => {
    if (!restored || ok) return;
    writeRegistrationDraft(branchSlug, form);
  }, [branchSlug, form, restored, ok]);

  function setField(key, value) {
    setFieldErr((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setCountryAndAutoNationality(countryValue) {
    setForm((f) => ({
      ...f,
      country: countryValue,
      nationality: nationalityFromCountry(countryValue)
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const nextFieldErr = {};
    if (!isYmd(form.birth_date)) {
      nextFieldErr.birth_date = "Bitte geben Sie ein gültiges Geburtsdatum an.";
    }
    if (!String(form.phone || "").trim()) {
      nextFieldErr.phone = "Bitte geben Sie eine Handynummer an.";
    }
    if (!String(form.email || "").trim()) {
      nextFieldErr.email = "Bitte geben Sie eine E-Mailadresse an.";
    }
    if (!String(form.license_plate || "").trim()) {
      nextFieldErr.license_plate = "Bitte geben Sie Ihr Kfz-Kennzeichen an.";
    }
    setFieldErr(nextFieldErr);
    if (Object.keys(nextFieldErr).length > 0) {
      setErr("Bitte prüfen Sie die markierten Pflichtfelder.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: branchSlug,
          arrival_date: form.arrival_date,
          departure_date: form.departure_date,
          adults_count: Number(form.adults_count),
          children_count: Number(form.children_count),
          infants_count: Number(form.infants_count),
          dogs_count: Number(form.dogs_count),
          other_pets_count: Number(form.other_pets_count),
          first_name: form.first_name,
          last_name: form.last_name,
          birth_date: form.birth_date,
          nationality: form.nationality || undefined,
          country: form.country || undefined,
          street: form.street || undefined,
          postcode: form.postcode || undefined,
          city: form.city || undefined,
          id_number: form.id_number || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          license_plate: form.license_plate || undefined,
          payment_method: form.payment_method || undefined,
          notes: form.notes?.trim() || undefined,
          source: "register"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Senden fehlgeschlagen.");
        setLoading(false);
        return;
      }
      clearRegistrationDraft(branchSlug);
      if (data.registration_number != null) {
        const n = Number(data.registration_number);
        setRegistrationNumber(n);
        writeRegistrationNumberSession(branchSlug, n);
      }
      setOk(true);
    } catch (ex) {
      setErr(String(ex.message || ex));
    }
    setLoading(false);
  }

  if (ok && registrationNumber != null) {
    return (
      <div className="space-y-4">
        <div className="fb-hero text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Gespeichert</p>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            Bitte merken Sie sich Ihre Nummer für die Rezeption — dort können Sie sie vorzeigen.
          </p>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-white/80">Ihre Anmeldenummer</p>
          <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-white sm:text-5xl">#{registrationNumber}</p>
          <div className="mt-4">
            <Link
              href={`/b/${branchSlug}/register`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/35"
            >
              Zurück zur Registrierung
            </Link>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-white/95">
            Wenn Sie möchten, können Sie jetzt direkt Frühstück für morgen bestellen.
          </p>
          <div className="mt-4">
            <Link
              href={`/b/${branchSlug}/order`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-amber-900 shadow-md"
            >
              Frühstück für morgen bestellen
            </Link>
          </div>
        </div>
        <div className="fb-card text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            {branchName ? (
              <>
                Standort: <strong className="text-slate-900">{branchName}</strong>
              </>
            ) : null}
          </p>
          <p className="mt-4 text-xs text-slate-500">Sie können dieses Fenster schließen.</p>
        </div>
      </div>
    );
  }

  if (ok) {
    return (
      <div className="fb-card text-center">
        <p className="text-sm font-semibold text-slate-900">Vielen Dank!</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Ihre Angaben wurden übermittelt. {branchName ? <strong>{branchName}</strong> : null}
        </p>
        <p className="mt-4 text-xs text-slate-500">Sie können dieses Fenster schließen.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="fb-card space-y-6 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
      <p className="text-xs leading-relaxed text-slate-500">
        Angaben für die Rezeption werden nur vorübergehend gespeichert und bei Erledigung oder Ablauf gelöscht. Dauerhaft
        werden nur anonymisierte Kennzahlen (ohne Namen, Kontaktdaten und Adresse) ausgewertet.
      </p>

      <FormSection title="Aufenthalt" hint="Wann sind Sie da?" highlight>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="fb-label" htmlFor="reg-arrival">
              Anreise <span className="text-amber-800">*</span>
            </label>
            <input
              id="reg-arrival"
              type="date"
              required
              className="fb-input text-base font-medium text-slate-900"
              value={form.arrival_date}
              onChange={(e) => setField("arrival_date", e.target.value)}
            />
          </div>
          <div>
            <label className="fb-label" htmlFor="reg-departure">
              Abreise <span className="text-amber-800">*</span>
            </label>
            <input
              id="reg-departure"
              type="date"
              required
              className="fb-input text-base font-medium text-slate-900"
              value={form.departure_date}
              onChange={(e) => setField("departure_date", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Gäste" hint="Personen und Hunde im Aufenthalt." highlight>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["adults_count", "Erwachsene", "E"],
            ["children_count", "Kinder", "K"],
            ["infants_count", "Kleinkinder", "Kl"],
            ["dogs_count", "Hunde", "H"]
          ].map(([key, label, short]) => (
            <div key={key}>
              <label className="fb-label" htmlFor={`reg-${key}`}>
                {label} <span className="text-slate-400">({short})</span>
              </label>
              <input
                id={`reg-${key}`}
                type="number"
                min={0}
                max={500}
                className="fb-input tabular-nums"
                value={form[key]}
                onChange={(e) => setField(key, Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
              />
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Person" hint="Wie in Ihrem Ausweis angegeben.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="fb-label" htmlFor="reg-fn">
              Vorname <span className="font-semibold text-amber-800">*</span>
            </label>
            <input
              id="reg-fn"
              required
              className={personInputClass}
              autoComplete="given-name"
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
            />
          </div>
          <div>
            <label className="fb-label" htmlFor="reg-ln">
              Nachname <span className="font-semibold text-amber-800">*</span>
            </label>
            <input
              id="reg-ln"
              required
              className={personInputClass}
              autoComplete="family-name"
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
            />
          </div>
        </div>
        <div className="sm:max-w-sm">
          <label className="fb-label" htmlFor="reg-birth">
            Geburtsdatum <span className="font-semibold text-amber-800">*</span>
          </label>
          <input
            id="reg-birth"
            type="date"
            required
            className={`${personInputClass} text-base`}
            value={form.birth_date}
            onChange={(e) => setField("birth_date", e.target.value)}
          />
          {fieldErr.birth_date ? <p className="mt-1 text-xs text-red-700">{fieldErr.birth_date}</p> : null}
        </div>
      </FormSection>

      <FormSection title="Kontakt" hint="Für Rückfragen an der Rezeption.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="fb-label" htmlFor="reg-phone">
              Handynummer <span className="font-semibold text-amber-800">*</span>
            </label>
            <input
              id="reg-phone"
              type="tel"
              required
              className={keyInputClass}
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
            {fieldErr.phone ? <p className="mt-1 text-xs text-red-700">{fieldErr.phone}</p> : null}
          </div>
          <div className="min-w-0">
            <label className="fb-label" htmlFor="reg-email">
              E-Mailadresse <span className="font-semibold text-amber-800">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              required
              className={keyInputClass}
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
            {fieldErr.email ? <p className="mt-1 text-xs text-red-700">{fieldErr.email}</p> : null}
          </div>
          <div className="min-w-0 sm:col-span-2">
            <label className="fb-label" htmlFor="reg-plate">
              Kfz-Kennzeichen / License plate <span className="font-semibold text-amber-800">*</span>
            </label>
            <input
              id="reg-plate"
              required
              className={keyInputClass}
              autoComplete="off"
              placeholder="z. B. B-AB 1234"
              value={form.license_plate}
              onChange={(e) => setField("license_plate", e.target.value)}
            />
            {fieldErr.license_plate ? <p className="mt-1 text-xs text-red-700">{fieldErr.license_plate}</p> : null}
          </div>
        </div>
      </FormSection>

      <FormSection title="Weitere Angaben" hint="Land zuerst wählen — Staatsangehörigkeit wird automatisch gefüllt.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="fb-label" htmlFor="reg-country">
              Land
            </label>
            <select
              id="reg-country"
              className="fb-input text-base"
              value={form.country}
              onChange={(e) => setCountryAndAutoNationality(e.target.value)}
            >
              <option value="">Bitte wählen…</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="fb-label" htmlFor="reg-nationality">
              Staatsangehörigkeit
            </label>
            <input
              id="reg-nationality"
              className={keyInputClass}
              value={form.nationality}
              onChange={(e) => setField("nationality", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="fb-label" htmlFor="reg-notes">
            Sonstige Hinweise
          </label>
          <textarea
            id="reg-notes"
            rows={3}
            className="fb-input min-h-[5rem] resize-y py-2"
            placeholder="Besonderheiten, Wünsche …"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Adresse & mehr (optional)</p>
        <div>
          <label className="fb-label" htmlFor="reg-street">
            Straße / Hausnr.
          </label>
          <input
            id="reg-street"
            className="fb-input"
            autoComplete="street-address"
            value={form.street}
            onChange={(e) => setField("street", e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="fb-label" htmlFor="reg-plz">
              PLZ
            </label>
            <input
              id="reg-plz"
              className="fb-input"
              autoComplete="postal-code"
              value={form.postcode}
              onChange={(e) => setField("postcode", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="fb-label" htmlFor="reg-city">
              Ort
            </label>
            <input
              id="reg-city"
              className="fb-input"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => setField("city", e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="fb-label" htmlFor="reg-other-pets">
              Sonst. Tiere
            </label>
            <input
              id="reg-other-pets"
              type="number"
              min={0}
              max={100}
              className="fb-input tabular-nums"
              value={form.other_pets_count}
              onChange={(e) =>
                setField("other_pets_count", Math.max(0, Math.min(100, Number(e.target.value) || 0)))
              }
            />
          </div>
          <div>
            <label className="fb-label" htmlFor="reg-idn">
              Ausweis-Nr.
            </label>
            <input id="reg-idn" className="fb-input" value={form.id_number} onChange={(e) => setField("id_number", e.target.value)} />
          </div>
        </div>
        <div className="sm:max-w-sm">
          <label className="fb-label" htmlFor="reg-pay">
            Zahlungsart
          </label>
          <input
            id="reg-pay"
            className="fb-input"
            placeholder="z. B. EC-Karte, Bar"
            value={form.payment_method}
            onChange={(e) => setField("payment_method", e.target.value)}
          />
        </div>
      </FormSection>

      {err ? <p className="fb-alert-error">{err}</p> : null}
      <button type="submit" disabled={loading} className="fb-btn-primary w-full py-3.5 text-base font-bold">
        {loading ? "…" : "Anmeldung absenden"}
      </button>
    </form>
  );
}
