/** URL-safe branch slug (shared server/client; no Node-only imports). */
export function normalizeBranchSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}
