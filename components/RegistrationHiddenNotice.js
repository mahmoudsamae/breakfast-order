"use client";

import Link from "next/link";
import BranchAppChrome from "@/components/BranchAppChrome";
import { useI18n } from "@/components/I18nProvider";

export default function RegistrationHiddenNotice({ branchSlug, branchName }) {
  const { t } = useI18n();

  return (
    <div className="fb-page-order">
      <BranchAppChrome branchSlug={branchSlug} branchName={branchName} />
      <div className="mx-auto max-w-md rounded-3xl border border-brand-yellow/40 bg-white p-6 text-center shadow-md ring-1 ring-slate-200/90 sm:p-8">
        <p className="text-3xl" aria-hidden>
          ℹ️
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">{t("register.disabledTitle")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{t("register.disabledBody")}</p>
        <Link
          href={`/b/${branchSlug}`}
          className="fb-btn-primary mt-6 inline-flex min-h-12 w-full items-center justify-center text-base font-bold"
        >
          {t("register.backToStart")}
        </Link>
      </div>
    </div>
  );
}
