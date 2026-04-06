import { redirect } from "next/navigation";

/** @deprecated Use /b/[slug]/order. Redirect uses NEXT_PUBLIC_DEFAULT_BRANCH_SLUG when set. */
export default function LegacyOrderRedirect() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_SLUG;
  if (!slug) redirect("/");
  redirect(`/b/${slug}/order`);
}
