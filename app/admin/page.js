import { redirect } from "next/navigation";

export default function LegacyAdminRedirect() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_SLUG;
  if (!slug) redirect("/");
  redirect(`/b/${slug}/admin`);
}
