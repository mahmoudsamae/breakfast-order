import {
  EIGENES_GETRAENKE,
  EIGENES_MARMELADE,
  EIGENES_PREIS_MARMELADE,
  eigenesGetraenkPreis,
  summeEigenesMenueZusatzEntry
} from "@/lib/eigenes-menue";

/**
 * Builds a JSON-serializable cart snapshot for success modal + localStorage.
 * Mirrors the customer cart preview line structure (including labels).
 */
export function buildOrderSummarySnapshot({ products, menus, productQty, menuQty, eigenesMenueZusatz }) {
  const lines = [];
  const zusatz = eigenesMenueZusatz || [];

  for (const p of products) {
    const q = Number(productQty[String(p.id)] || 0);
    if (q <= 0) continue;
    const unit = Number(p.price || 0);
    const line = Math.round(q * unit * 100) / 100;
    lines.push({
      key: `p-${p.id}`,
      icon: "🥐",
      badge: "Backware",
      title: p.name,
      qty: q,
      unit,
      line
    });
  }

  for (const m of menus) {
    const q = Number(menuQty[String(m.id)] || 0);
    if (q <= 0) continue;
    const unit = Number(m.price || 0);
    const line = Math.round(q * unit * 100) / 100;
    lines.push({
      key: `m-${m.id}`,
      icon: "📋",
      badge: "Menü",
      title: m.name,
      qty: q,
      unit,
      line
    });
  }

  zusatz.forEach((z, idx) => {
    lines.push({
      key: `em-head-${idx}`,
      header: true,
      title: zusatz.length > 1 ? `Eigenes Menü (${idx + 1})` : "Eigenes Menü (Zusatz)"
    });
    for (const [k, raw] of Object.entries(z.marmelade || {})) {
      const n = Number(raw || 0);
      if (n <= 0) continue;
      const unit = Number(EIGENES_PREIS_MARMELADE[k] || 0);
      const def = EIGENES_MARMELADE.find((x) => x.key === k);
      const line = Math.round(n * unit * 100) / 100;
      lines.push({
        key: `em-j-${idx}-${k}`,
        icon: def?.icon || "🍯",
        badge: "Marmelade",
        title: def?.label || k,
        qty: n,
        unit,
        line
      });
    }
    const d = EIGENES_GETRAENKE.find((x) => x.key === z.getraenk);
    const gu = eigenesGetraenkPreis(z.getraenk);
    lines.push({
      key: `em-d-${idx}`,
      icon: d?.icon || "☕",
      badge: "Getränk",
      title: d?.label || z.getraenk,
      qty: 1,
      unit: gu,
      line: gu
    });
  });

  let sum = 0;
  for (const p of products) sum += Number(p.price || 0) * Number(productQty[String(p.id)] || 0);
  for (const m of menus) sum += Number(m.price || 0) * Number(menuQty[String(m.id)] || 0);
  sum += zusatz.reduce((a, z) => a + summeEigenesMenueZusatzEntry(z), 0);
  const total = Math.round(sum * 100) / 100;

  return { lines, total };
}
