function key(branchSlug) {
  return `fb_branch_registration_number_${String(branchSlug || "").toLowerCase()}`;
}

/** Remember last registration number for optional breakfast conversion (sessionStorage). */
export function writeRegistrationNumberSession(branchSlug, registrationNumber) {
  if (typeof window === "undefined") return;
  try {
    if (registrationNumber != null && Number.isFinite(Number(registrationNumber))) {
      window.sessionStorage.setItem(key(branchSlug), String(registrationNumber));
    }
  } catch {
    /* ignore */
  }
}

export function readRegistrationNumberSession(branchSlug) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(branchSlug));
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function clearRegistrationNumberSession(branchSlug) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key(branchSlug));
  } catch {
    /* ignore */
  }
}
