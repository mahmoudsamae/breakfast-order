"use client";

export default function QuantityPicker({ value, onChange, disabled, max = 99, size = "default" }) {
  const atMax = max != null && value >= max;
  if (size === "compact") {
    return (
      <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm">
        <button
          type="button"
          disabled={disabled}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold leading-none text-slate-700 transition hover:bg-slate-100 active:bg-slate-200/80 disabled:opacity-40 sm:h-9 sm:w-9 sm:text-base"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label="Weniger"
        >
          −
        </button>
        <span className="min-w-[2.25rem] px-1.5 text-center text-xl font-black tabular-nums text-brand-green sm:min-w-[2rem] sm:text-lg">{value}</span>
        <button
          type="button"
          disabled={disabled || atMax}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-green text-lg font-bold leading-none text-white transition hover:brightness-95 active:brightness-90 disabled:opacity-40 sm:h-9 sm:w-9 sm:text-base"
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label="Mehr"
        >
          +
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/80">
      <button
        type="button"
        disabled={disabled}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Decrease"
      >
        −
      </button>
      <span className="min-w-[2rem] text-center text-lg font-black tabular-nums text-brand-green">{value}</span>
      <button
        type="button"
        disabled={disabled || atMax}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-green text-lg font-bold text-white shadow-md transition hover:brightness-95 disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
