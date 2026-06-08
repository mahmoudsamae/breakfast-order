import { getSupabaseServerClient } from "@/lib/supabase";

const REGISTRATION_KEY = "registration_enabled";

function parseSettingBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  return false;
}

function isMissingSettingsTable(error) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message || "").includes("platform_settings");
}

/** Whether guest/staff registration UI and APIs are active. */
export async function getRegistrationEnabled() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", REGISTRATION_KEY)
      .maybeSingle();

    if (error) {
      if (isMissingSettingsTable(error)) return false;
      return false;
    }

    return parseSettingBoolean(data?.value);
  } catch {
    return false;
  }
}

export async function setRegistrationEnabled(enabled) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("platform_settings").upsert(
    {
      key: REGISTRATION_KEY,
      value: Boolean(enabled),
      updated_at: new Date().toISOString()
    },
    { onConflict: "key" }
  );

  if (error) {
    if (isMissingSettingsTable(error)) {
      const err = new Error("Plattform-Einstellungen sind noch nicht migriert (platform_settings).");
      err.status = 503;
      throw err;
    }
    throw error;
  }
}
