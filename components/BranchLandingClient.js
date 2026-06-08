"use client";

import Link from "next/link";
import BranchAppChrome from "@/components/BranchAppChrome";
/** Standort-Startseite — fest auf Deutsch (Sprachwahl nur auf der Bestellseite). */
export default function BranchLandingClient({ branchSlug, branchName, showRegistration = false }) {
  const base = `/b/${branchSlug}`;

  return (
    <>
      <BranchAppChrome branchSlug={branchSlug} branchName={branchName} variant="landing" />
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="fb-hero text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Standort</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">{branchName}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/90 sm:text-base">Was möchten Sie tun?</p>
        </div>
        <div className="flex flex-col gap-3 sm:gap-4">
          <Link
            href={`${base}/order`}
            className="fb-btn-primary inline-flex min-h-[3.25rem] items-center justify-center px-6 py-4 text-center text-base font-bold shadow-md sm:min-h-[3.5rem] sm:text-lg"
          >
            Frühstück bestellen
          </Link>
          {showRegistration ? (
            <Link
              href={`${base}/register`}
              className="fb-btn-secondary inline-flex min-h-[3.25rem] items-center justify-center px-6 py-4 text-center text-base font-bold shadow-sm sm:min-h-[3.5rem] sm:text-lg"
            >
              Registrieren
            </Link>
          ) : null}
        </div>
      </div>
      <footer className="mt-10 border-t border-slate-200/80 pt-4 text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
        <p className="font-medium text-slate-600/90">{branchName}</p>
        <p>Frühstück vorbestellen — einfach und schnell.</p>
      </footer>
    </>
  );
}
