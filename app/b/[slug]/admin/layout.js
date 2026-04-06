import { redirect } from "next/navigation";
import { getSessionFromCookies, normalizeBranchSlug } from "@/lib/internal-session";

export default async function AdminBranchLayout({ children, params }) {
  const session = await getSessionFromCookies();
  const slug = normalizeBranchSlug(params.slug);
  if (!session || normalizeBranchSlug(session.branchSlug) !== slug) {
    redirect(`/b/${params.slug}/login?next=${encodeURIComponent(`/b/${params.slug}/admin`)}`);
  }
  if (session.role !== "admin") {
    redirect(`/b/${params.slug}/login`);
  }
  return children;
}
