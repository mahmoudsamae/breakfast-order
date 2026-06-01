"use client";

import { useI18n } from "@/components/I18nProvider";

/**
 * Große, klare Bestätigung bei erkanntem Doppelbestellungs-Versuch (ältere Gäste).
 */
export default function DuplicateOrderConfirmModal({
  open,
  customerName,
  existingOrderNumber,
  pickupDateLabel,
  onCancel,
  onConfirm
}) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-order-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow/25 text-3xl" aria-hidden>
          ⚠️
        </div>
        <h3 id="duplicate-order-title" className="text-center text-xl font-bold text-slate-900">
          {t("duplicate.title")}
        </h3>
        <p className="mt-3 text-center text-base leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">{customerName}</span>
          {existingOrderNumber != null ? (
            <>
              {", "}
              {pickupDateLabel ? (
                <>
                  {t("duplicate.alreadyFor")}{" "}
                  <span className="font-semibold">{pickupDateLabel}</span>{" "}
                </>
              ) : null}
              {t("duplicate.alreadyOrdered")}
            </>
          ) : (
            ` — ${t("duplicate.confirmQuestion")}`
          )}
        </p>
        {existingOrderNumber != null ? (
          <p className="mt-4 text-center">
            <span className="text-sm font-medium text-slate-500">{t("duplicate.yourNumber")}</span>
            <span className="mt-1 block text-4xl font-black tabular-nums text-brand-green">#{existingOrderNumber}</span>
          </p>
        ) : null}
        {existingOrderNumber != null ? (
          <p className="mt-4 text-center text-sm text-slate-600">{t("duplicate.confirmQuestion")}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-14 w-full rounded-2xl bg-brand-green px-4 py-3.5 text-base font-bold text-white shadow-md hover:brightness-95"
          >
            {t("duplicate.no")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-12 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("duplicate.yes")}
          </button>
        </div>
      </div>
    </div>
  );
}
