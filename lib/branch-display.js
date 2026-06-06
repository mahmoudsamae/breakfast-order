/** e.g. "AZUR Camping Regensburg (Test)" → "Regensburg" */
export function branchShortLabel(branchName, branchSlug) {
  if (branchName) {
    const short = String(branchName)
      .replace(/^AZUR\s+Camping\s+/i, "")
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .trim();
    if (short) return short;
  }
  if (branchSlug) {
    return String(branchSlug)
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return "Standort";
}
