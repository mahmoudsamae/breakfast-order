/**
 * „Eigenes Menü“ – reine Konfiguration (Preise + Schlüssel), ohne DB-Schema.
 * Wird von Kundenseite und /api/orders gemeinsam genutzt.
 */

export const EIGENES_BACKWAREN_KEYS = [
  { key: "knusper", productName: "Knusperbrötchen", label: "Knusperbrötchen", icon: "🥖" },
  { key: "farmer", productName: "Farmerbrötchen", label: "Farmerbrötchen", icon: "🥐" },
  { key: "laugen", productName: "Laugenbrezel", label: "Laugenbrezel", icon: "🥨" },
  { key: "butter", productName: "Buttercroissant", label: "Buttercroissant", icon: "🥐" }
];

export const EIGENES_MARMELADE = [
  { key: "erdbeere", label: "Erdbeere", icon: "🍓" },
  { key: "aprikose", label: "Aprikose", icon: "🍑" },
  { key: "honig", label: "Kirsche", icon: "🍒" },
  { key: "nutella", label: "Nutella", icon: "🍫" }
];

export const EIGENES_GETRAENKE = [
  { key: "kaffee", label: "Kaffee", icon: "☕" },
  { key: "cappuccino", label: "Cappuccino", icon: "☕" },
  { key: "latte", label: "Latte", icon: "☕" },
  { key: "tee", label: "Tee", icon: "🫖" },
  { key: "espresso", label: "Espresso", icon: "☕" }
];

/** Feste Zusatzpreise (EUR) – nur Marmelade/Getränk, Backwaren über Produktpreise. */
export const EIGENES_PREIS_MARMELADE = {
  erdbeere: 0.4,
  aprikose: 0.4,
  honig: 0.45,
  nutella: 0.5
};

export const EIGENES_PREIS_GETRAENK = {
  kaffee: 2.2,
  cappuccino: 2.8,
  latte: 3.2,
  tee: 1.8,
  espresso: 2.0
};

export function eigenesMarmeladeSumme(qtyMap) {
  let s = 0;
  let totalQty = 0;
  for (const [k, raw] of Object.entries(qtyMap || {})) {
    const n = Number(raw || 0);
    if (!EIGENES_PREIS_MARMELADE[k] || n <= 0) continue;
    totalQty += n;
    s += n * EIGENES_PREIS_MARMELADE[k];
  }
  return { euro: s, qty: totalQty };
}

export function eigenesGetraenkPreis(key) {
  if (!key || EIGENES_PREIS_GETRAENK[key] == null) return 0;
  return EIGENES_PREIS_GETRAENK[key];
}

/** Eine Zusatz-Zeile „Eigenes Menü“ (Marmelade + Getränk) – Backwaren laufen über Produkte. */
export function summeEigenesMenueZusatzEntry(entry) {
  const m = eigenesMarmeladeSumme(entry?.marmelade || {});
  const g = eigenesGetraenkPreis(entry?.getraenk);
  return Math.round((m.euro + g) * 100) / 100;
}

export function formatEigenesMenueZusatzNote(entries) {
  if (!entries?.length) return "";
  const parts = entries.map((e) => {
    const jamBits = Object.entries(e.marmelade || {})
      .filter(([, q]) => Number(q) > 0)
      .map(([k, q]) => {
        const def = EIGENES_MARMELADE.find((x) => x.key === k);
        return `${Number(q)}×${def?.label || k}`;
      })
      .join("+");
    const d = EIGENES_GETRAENKE.find((x) => x.key === e.getraenk);
    return `Mz:${jamBits}; G:${d?.label || e.getraenk}`;
  });
  return parts.join(" | ");
}

const EM_SUFFIX = " · EM:";

/** Trennt Anzeige-Namen vom kompakten Eigenes-Menü-Suffix (wie in der DB in customer_name). */
export function parseEigenesMenueFromCustomerName(fullName) {
  if (!fullName || typeof fullName !== "string") return { cleanName: fullName || "", groups: [] };
  const idx = fullName.indexOf(EM_SUFFIX);
  if (idx === -1) return { cleanName: fullName.trim(), groups: [] };
  const cleanName = fullName.slice(0, idx).trim();
  const encoded = fullName.slice(idx + EM_SUFFIX.length).trim();
  if (!encoded) return { cleanName, groups: [] };

  const groups = [];
  for (const block of encoded.split(" | ").map((b) => b.trim()).filter(Boolean)) {
    const parsed = parseEigenesEncodedBlock(block);
    if (parsed) groups.push(parsed);
  }
  return { cleanName, groups };
}

function parseEigenesEncodedBlock(block) {
  const gIdx = block.indexOf("; G:");
  if (gIdx === -1 || !block.startsWith("Mz:")) return null;
  const jamStr = block.slice(3, gIdx);
  const drinkLabel = block.slice(gIdx + "; G:".length).trim();
  const jams = [];
  for (const seg of jamStr.split("+").map((s) => s.trim()).filter(Boolean)) {
    const m = seg.match(/^(\d+)×(.+)$/);
    if (!m) continue;
    const qty = Number(m[1]);
    const label = m[2].trim();
    const def = EIGENES_MARMELADE.find((x) => x.label === label);
    jams.push({ qty, label, icon: def?.icon || "🍯" });
  }
  const dDef = EIGENES_GETRAENKE.find((x) => x.label === drinkLabel);
  return {
    jams,
    drink: { label: drinkLabel, icon: dDef?.icon || "☕" }
  };
}

/** Server: validiert ein Array von Zusatz-Einträgen, wirft bei Fehler. */
export function validateEigenesMenueZusatzEntries(entries) {
  if (entries == null) return { entries: [], extrasTotal: 0 };
  if (!Array.isArray(entries)) throw new Error("Ungültige Eigenes-Menü-Daten.");
  const clean = [];
  let extrasTotal = 0;
  for (const raw of entries) {
    const marmelade = raw?.marmelade || {};
    const getraenk = raw?.getraenk;
    const { qty: jamQty, euro: jamEur } = eigenesMarmeladeSumme(marmelade);
    if (jamQty < 1 || jamQty > 2) throw new Error("Eigenes Menü: Marmelade 1–2 Portionen.");
    if (!getraenk || eigenesGetraenkPreis(getraenk) <= 0) throw new Error("Eigenes Menü: Bitte ein Getränk wählen.");
    for (const k of Object.keys(marmelade)) {
      if (Number(marmelade[k]) > 0 && EIGENES_PREIS_MARMELADE[k] == null) throw new Error("Unbekannte Marmelade.");
    }
    const gEur = eigenesGetraenkPreis(getraenk);
    extrasTotal += jamEur + gEur;
    clean.push({ marmelade, getraenk });
  }
  return { entries: clean, extrasTotal: Math.round(extrasTotal * 100) / 100 };
}
