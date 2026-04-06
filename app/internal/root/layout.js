import Link from "next/link";
import { redirect } from "next/navigation";
import { getRootSessionFromCookies } from "@/lib/root-session";
import RootLogoutButton from "./RootLogoutButton";

export const dynamic = "force-dynamic";

export default async function InternalRootLayout({ children }) {
  const session = await getRootSessionFromCookies();
  if (!session) redirect("/internal/root-login");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-amber-400/30 bg-gradient-to-br from-amber-600 via-orange-500 to-rose-600 shadow-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">System</p>
            <p className="mt-0.5 text-sm font-bold text-white sm:text-base">Frühstück · Verwaltung</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-white/95">
            <Link href="/internal/root" className="rounded-lg px-1 py-0.5 hover:bg-white/15 hover:text-white">
              Übersicht
            </Link>
            <Link href="/internal/root/branches" className="rounded-lg px-1 py-0.5 hover:bg-white/15 hover:text-white">
              Standorte
            </Link>
            <Link href="/internal/root/users" className="rounded-lg px-1 py-0.5 hover:bg-white/15 hover:text-white">
              Konten
            </Link>
            <Link href="/" className="rounded-lg px-1 py-0.5 text-white/80 hover:bg-white/10 hover:text-white">
              Startseite
            </Link>
            <RootLogoutButton />
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}
