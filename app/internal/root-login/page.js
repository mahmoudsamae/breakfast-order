import { redirect } from "next/navigation";
import { getRootSessionFromCookies } from "@/lib/root-session";
import RootLoginForm from "./RootLoginForm";

export const dynamic = "force-dynamic";

export default async function RootLoginPage() {
  const session = await getRootSessionFromCookies();
  if (session) redirect("/internal/root");

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/90 via-white to-slate-50">
      <div className="fb-page-narrow max-w-lg">
        <RootLoginForm />
      </div>
    </div>
  );
}
