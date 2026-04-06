/** Shared heading block for root admin pages (matches app typography / staff “eyebrow”). */
export default function RootSectionTitle({ eyebrow = "Administration", title, subtitle }) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900/70">{eyebrow}</p>
      ) : null}
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p> : null}
    </div>
  );
}
