/**
 * Packliste drucken: Inhalt an den Seitenanfang klonen (vermeidet falschen Start
 * mitten in der scrollbaren Vorschau).
 */
export function printPacklisteDocument(sourceSelector = "#packliste-print-area") {
  if (typeof window === "undefined") return () => {};

  const source = document.querySelector(sourceSelector);
  if (!source) return () => {};

  const hostId = "packliste-print-host";
  const existing = document.getElementById(hostId);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = hostId;
  host.setAttribute("data-packliste-print-host", "true");

  const clone = source.cloneNode(true);
  clone.id = "packliste-print-area-active";
  clone.setAttribute("data-packliste-print-active", "true");
  clone.classList.remove("max-h-[66dvh]", "overflow-auto");
  host.appendChild(clone);
  document.body.appendChild(host);

  const cls = "print-packliste-only";
  document.documentElement.classList.add(cls);
  document.body.classList.add(cls);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.getElementById(hostId)?.remove();
    document.documentElement.classList.remove(cls);
    document.body.classList.remove(cls);
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup, { once: true });

  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 2000);
    });
  });

  return cleanup;
}
