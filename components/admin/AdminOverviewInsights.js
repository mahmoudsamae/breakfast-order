"use client";

import { formatMoney } from "@/lib/format-money";

function SectionTitle({ children, hint = null }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-black uppercase tracking-wider text-brand-green">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function KpiCard({ label, value, hint = null, footer = null, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-200/90 bg-white",
    green: "border-brand-green/25 bg-gradient-to-br from-brand-green/[0.08] to-white",
    teal: "border-brand-teal/25 bg-gradient-to-br from-brand-teal/[0.08] to-white",
    orange: "border-brand-orange/25 bg-gradient-to-br from-brand-orange/[0.08] to-white",
    yellow: "border-brand-yellow/40 bg-gradient-to-br from-brand-yellow/15 to-white"
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ring-1 ring-slate-100/80 ${tones[tone] || tones.neutral}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{value}</p>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</div> : null}
      {footer}
    </div>
  );
}

function DeltaBadge({ value }) {
  const n = Number(value);
  const up = n > 0;
  const down = n < 0;
  const cls = up ? "bg-brand-green/15 text-brand-green" : down ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${cls}`}>
      {up ? "+" : ""}
      {n}%
    </span>
  );
}

function Trend14Chart({ rows, todayDate }) {
  const w = 640;
  const h = 200;
  const pad = { t: 16, r: 12, b: 36, l: 40 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxOrders = Math.max(...rows.map((r) => r.orders), 1);
  const maxRev = Math.max(...rows.map((r) => r.revenue), 1);
  const n = rows.length;
  const step = innerW / Math.max(n - 1, 1);

  const orderPoints = rows
    .map((r, i) => {
      const x = pad.l + i * step;
      const y = pad.t + innerH - (r.orders / maxOrders) * innerH;
      return `${x},${y}`;
    })
    .join(" ");

  const revBars = rows.map((r, i) => {
    const barW = Math.max(innerW / n - 4, 6);
    const x = pad.l + i * (innerW / n) + 2;
    const barH = (r.revenue / maxRev) * innerH * 0.45;
    const y = pad.t + innerH - barH;
    return { x, y, barW, barH, ...r };
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[320px] w-full" role="img" aria-label="14-Tage Trend Bestellungen und Umsatz">
        {[0, 0.5, 1].map((frac) => {
          const y = pad.t + innerH * (1 - frac);
          const val = Math.round(maxOrders * frac);
          return (
            <g key={frac}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                {val}
              </text>
            </g>
          );
        })}
        {revBars.map((b) => (
          <rect
            key={b.date}
            x={b.x}
            y={b.y}
            width={b.barW}
            height={b.barH}
            rx="2"
            fill="#efc462"
            fillOpacity="0.55"
          />
        ))}
        <polyline points={orderPoints} fill="none" stroke="#649552" strokeWidth="2.5" strokeLinejoin="round" />
        {rows.map((r, i) => {
          const x = pad.l + i * step;
          const y = pad.t + innerH - (r.orders / maxOrders) * innerH;
          const isToday = r.date === todayDate;
          return (
            <g key={r.date}>
              <circle cx={x} cy={y} r={isToday ? 5 : 3.5} fill={isToday ? "#e95c2f" : "#649552"} />
              <title>
                {r.label}: {r.orders} Bestellungen, {formatMoney(r.revenue)} Umsatz (ausgeliefert)
              </title>
            </g>
          );
        })}
        {rows.map((r, i) => {
          if (i % 2 !== 0 && i !== n - 1) return null;
          const x = pad.l + i * step;
          return (
            <text key={`lbl-${r.date}`} x={x} y={h - 8} textAnchor="middle" className="fill-slate-500 text-[9px]">
              {r.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-brand-green" /> Bestellungen (Eingang)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-brand-yellow/70" /> Umsatz ausgeliefert
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-orange" /> Heute
        </span>
      </div>
    </div>
  );
}

function HourlyOrderingChart({ rows, peakHour }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const w = 640;
  const h = 200;
  const pad = { t: 12, r: 8, b: 28, l: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = rows.length || 1;
  const slotW = innerW / n;
  const barW = Math.min(28, slotW * 0.72);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[300px] w-full" role="img" aria-label="Bestellzeiten 08 bis 21 Uhr">
          <defs>
            <linearGradient id="hourBarGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#57adae" />
              <stop offset="100%" stopColor="#649552" />
            </linearGradient>
            <linearGradient id="hourPeakGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#e95c2f" />
              <stop offset="100%" stopColor="#efc462" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((frac) => {
            const y = pad.t + innerH * (1 - frac);
            const val = Math.round(max * frac);
            return (
              <g key={frac}>
                <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={pad.l - 6} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                  {val}
                </text>
              </g>
            );
          })}
          {rows.map((row, i) => {
            const barH = row.count > 0 ? Math.max(6, (row.count / max) * innerH) : 0;
            const x = pad.l + i * slotW + (slotW - barW) / 2;
            const y = pad.t + innerH - barH;
            const isPeak = row.hour === peakHour && row.count > 0;
            const fill = isPeak ? "url(#hourPeakGrad)" : "url(#hourBarGrad)";
            return (
              <g key={row.hour}>
                <rect x={x} y={y} width={barW} height={barH} rx="3" fill={fill}>
                  <title>{`${String(row.hour).padStart(2, "0")}:00 – ${row.count} Bestellungen`}</title>
                </rect>
                {row.hour % 2 === 0 ? (
                  <text x={x + barW / 2} y={h - 8} textAnchor="middle" className="fill-slate-500 text-[9px]">
                    {String(row.hour).padStart(2, "0")}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Bestellungen nach Uhrzeit (08–21 Uhr, Berlin) · {total.toLocaleString("de-DE")} Bestellungen in diesem Fenster
        {peakHour != null && max > 0 ? (
          <>
            {" "}
            · Peak: {String(peakHour).padStart(2, "0")}:00
          </>
        ) : null}
      </p>
    </div>
  );
}

function WeekCompareChart({ summary }) {
  const orderMax = Math.max(summary.ordersThisWeek, summary.ordersLastWeek, 1);
  const revMax = Math.max(summary.revenueThisWeek, summary.revenueLastWeek, 1);
  const bars = [
    { label: "Bestellungen KW", value: summary.ordersThisWeek, color: "#649552", max: orderMax },
    { label: "Bestellungen VOW", value: summary.ordersLastWeek, color: "#94a3b8", max: orderMax },
    { label: "Umsatz KW", value: summary.revenueThisWeek, color: "#57adae", money: true, max: revMax },
    { label: "Umsatz VOW", value: summary.revenueLastWeek, color: "#cbd5e1", money: true, max: revMax }
  ];

  return (
    <div className="space-y-3">
      {bars.map((b) => (
        <div key={b.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-slate-600">{b.label}</span>
            <span className="font-bold tabular-nums text-slate-900">{b.money ? formatMoney(b.value) : b.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(4, (b.value / b.max) * 100)}%`, backgroundColor: b.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopBarList({ title, rows, barColor }) {
  const max = Math.max(...(rows || []).map((r) => r.qty), 1);
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h3>
      <ol className="mt-4 space-y-3">
        {(rows || []).map((row, idx) => (
          <li key={row.name}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-slate-700">
                <span className="font-bold text-slate-400">{idx + 1}.</span> {row.name}
              </span>
              <span className="shrink-0 font-bold tabular-nums">{row.qty}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(6, (row.qty / max) * 100)}%`, backgroundColor: barColor }}
              />
            </div>
          </li>
        ))}
        {!rows?.length ? <li className="text-sm text-slate-500">Noch keine Daten.</li> : null}
      </ol>
    </div>
  );
}

function TodayStatusDonut({ summary }) {
  const parts = [
    { key: "delivered", label: "Ausgeliefert", value: summary.deliveredToday, color: "#649552" },
    { key: "pending", label: "Offen", value: summary.pendingToday, color: "#57adae" },
    { key: "missed", label: "Nicht abgeholt", value: summary.notPickedUpToday || 0, color: "#e95c2f" }
  ];
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (total === 0) {
    return (
      <p className="text-sm text-slate-500">Heute noch keine Abholungen mit Status erfasst.</p>
    );
  }
  let acc = 0;
  const r = 44;
  const c = 2 * Math.PI * r;
  const slices = parts.map((p) => {
    const frac = p.value / total;
    const dash = frac * c;
    const offset = acc;
    acc += dash;
    return { ...p, dash, offset, frac };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {slices.map((s) =>
          s.value > 0 ? (
            <circle
              key={s.key}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${s.dash} ${c - s.dash}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 60 60)"
            />
          ) : null
        )}
        <text x="60" y="56" textAnchor="middle" className="fill-slate-900 text-lg font-black">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" className="fill-slate-500 text-[9px] font-semibold">
          Abholung heute
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-600">{p.label}</span>
            <span className="ml-auto font-bold tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminOverviewInsights({ summary, showRegistration, onOpenNotPickedUp }) {
  const todayDate = summary.ordersTrend14Days?.[summary.ordersTrend14Days.length - 1]?.date;

  return (
    <div className="space-y-8">
      {(summary.alerts || []).length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>Handlungsempfehlungen</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.alerts.map((a) => (
              <div
                key={a.title}
                className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                  a.level === "warn"
                    ? "border-brand-orange/35 bg-brand-orange/10 text-slate-800"
                    : "border-brand-teal/30 bg-brand-teal/10 text-slate-800"
                }`}
              >
                <p className="font-bold">{a.title}</p>
                <p className="mt-1 leading-relaxed text-slate-700">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle hint="Live aus der Datenbank · Abholung und Eingang heute">Heute · Leitstand</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard tone="green" label="Bestellungen heute" value={summary.ordersToday} hint="Nach Bestellzeitstempel" />
          <KpiCard tone="teal" label="Umsatz heute" value={formatMoney(summary.revenueToday)} hint="Ausgelieferte Bestellungen" />
          <KpiCard
            tone="orange"
            label="Ø Bon heute"
            value={summary.deliveredToday > 0 ? formatMoney(summary.avgOrderValueToday) : "—"}
            hint="Umsatz ÷ ausgeliefert"
          />
          <KpiCard tone="yellow" label="Artikel heute" value={summary.itemsToday} hint="Stück in Bestellungen" />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <KpiCard label="Offen (Abholung heute)" value={summary.pendingToday} tone="teal" />
          <KpiCard label="Ausgeliefert heute" value={summary.deliveredToday} tone="green" />
          <KpiCard
            label="Abholquote heute"
            value={summary.pickupFulfilledPct != null ? `${summary.pickupFulfilledPct}%` : "—"}
            hint={
              summary.pickupTodayTotal > 0
                ? `${summary.deliveredToday} von ${summary.pickupTodayTotal} Abholungen`
                : "Keine Abholungen heute"
            }
            tone="orange"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <SectionTitle>Abholstatus heute</SectionTitle>
          <TodayStatusDonut summary={summary} />
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <SectionTitle>Planung</SectionTitle>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3 rounded-xl bg-brand-yellow/15 px-3 py-2.5">
              <span className="text-slate-700">Vorbestellung morgen (offen)</span>
              <span className="text-lg font-black text-brand-orange">{summary.pendingTomorrow}</span>
            </li>
            <li className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <span className="text-slate-500">Peak-Bestellzeit (08–21 Uhr)</span>
              <span className="font-bold text-slate-900">{summary.peakHourLabel || "—"}</span>
            </li>
            <li className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <span className="text-slate-500">Bestellungen 18–21 Uhr (gesamt)</span>
              <span className="font-bold">{summary.orders18to21}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-slate-500">Im Bestellfenster 08–21 Uhr</span>
              <span className="font-bold">
                {summary.ordersBusinessHoursPct}%{" "}
                <span className="font-normal text-slate-500">({summary.ordersBusinessHours})</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <SectionTitle hint="Eingang pro Tag · Umsatz am Auslieferungstag">14-Tage Verlauf</SectionTitle>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
          <Trend14Chart rows={summary.ordersTrend14Days || []} todayDate={todayDate} />
        </div>
      </section>

      <section>
        <SectionTitle hint="Wann Gäste bestellen — nur relevante Stunden">Bestellzeiten (08–21 Uhr)</SectionTitle>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
          <HourlyOrderingChart rows={summary.hourlyOrderingWindow || []} peakHour={summary.peakHour} />
        </div>
      </section>

      <section>
        <SectionTitle>Trends & Highlights</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kalenderwoche</p>
            <p className="mt-1 text-sm text-slate-600">{summary.weekRangeLabel}</p>
            <div className="mt-4">
              <WeekCompareChart summary={summary} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="text-slate-600">
                Δ Bestellungen: <DeltaBadge value={summary.weekOverWeekOrdersPct} />
              </span>
              <span className="text-slate-600">
                Δ Umsatz: <DeltaBadge value={summary.weekOverWeekRevenuePct} />
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Highlights</p>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="rounded-xl bg-brand-green/10 px-3 py-2">
                <span className="text-slate-500">Top-Produkt:</span>{" "}
                <span className="font-bold text-slate-900">{summary.topProduct || "—"}</span>
              </li>
              <li className="rounded-xl bg-brand-teal/10 px-3 py-2">
                <span className="text-slate-500">Top-Menü:</span>{" "}
                <span className="font-bold text-slate-900">{summary.topMenu || "—"}</span>
              </li>
              <li>
                <span className="text-slate-500">Peak:</span>{" "}
                <span className="font-bold">{summary.peakHourLabel || "—"}</span>
                {summary.peakOrderCount > 0 ? (
                  <span className="text-slate-500"> ({summary.peakOrderCount} Bestellungen)</span>
                ) : null}
              </li>
            </ul>
          </div>
        </div>
      </section>

      {showRegistration ? (
        <section>
          <SectionTitle>Gäste-Anmeldungen</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard label="Anmeldungen heute" value={summary.registrationsToday ?? 0} />
            <KpiCard label="Anmeldungen gesamt" value={summary.registrationsTotal ?? 0} />
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Eingänge pro Tag</p>
            <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-sm">
              {(summary.registrationDailyCounts || []).length === 0 ? (
                <li className="text-slate-500">Noch keine Anmeldungen.</li>
              ) : (
                summary.registrationDailyCounts.map((row) => (
                  <li key={row.date} className="flex justify-between gap-3 border-b border-slate-100 pb-1 last:border-0">
                    <span className="font-mono text-slate-700">{row.date}</span>
                    <span className="font-bold tabular-nums">{row.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>Gesamt · historisch</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Alle Bestellungen" value={summary.totalOrders} />
          <KpiCard label="Gesamtumsatz" value={formatMoney(summary.totalRevenue)} tone="green" />
          <KpiCard label="Verkaufte Artikel" value={summary.totalArticlesSold} />
          <KpiCard
            label="Nicht abgeholt gesamt"
            value={summary.notPickedUpTotal || 0}
            tone="orange"
            hint="Gesamt über alle Tage"
            footer={
              summary.notPickedUpDetails?.length ? (
                <button
                  type="button"
                  onClick={onOpenNotPickedUp}
                  className="mt-2 text-xs font-semibold text-brand-teal underline"
                >
                  Gründe anzeigen
                </button>
              ) : null
            }
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TopBarList title="Top 5 Produkte" rows={summary.topProducts} barColor="#649552" />
        <TopBarList title="Top 5 Menüs" rows={summary.topMenus} barColor="#57adae" />
      </section>
    </div>
  );
}
