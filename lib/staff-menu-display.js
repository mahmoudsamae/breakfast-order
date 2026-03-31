/**
 * Leitet Anzeigezeilen für Menü-Inhalt im Staff-Detail ab (aus menus.description).
 * Kein strukturiertes menu_items-Schema im Projekt → Beschreibungstext als Quelle.
 */

export function menuCompositionLinesFromDescription(description) {
  if (description == null || typeof description !== "string") return [];
  const t = description.trim();
  if (!t) return [];

  if (/\r?\n/.test(t)) {
    return t
      .split(/\r?\n+/)
      .map((line) =>
        line
          .trim()
          .replace(/^[\s\-–•*]+/, "")
          .replace(/^\d+[\).]\s*/, "")
          .trim()
      )
      .filter(Boolean);
  }

  if (t.includes("+")) {
    return t
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [t];
}
