const PREFIX = "fb_registration_draft_";

export function registrationDraftKey(branchSlug) {
  return `${PREFIX}${String(branchSlug || "").toLowerCase()}`;
}

export function readRegistrationDraft(branchSlug) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(registrationDraftKey(branchSlug));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

export function writeRegistrationDraft(branchSlug, data) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(registrationDraftKey(branchSlug), JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function clearRegistrationDraft(branchSlug) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(registrationDraftKey(branchSlug));
  } catch {
    /* ignore */
  }
}
