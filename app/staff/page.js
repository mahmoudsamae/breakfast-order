import { redirect } from "next/navigation";

export default function LegacyStaffRedirect() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_SLUG;
  if (!slug) redirect("/");
  redirect(`/b/${slug}/staff`);
}
