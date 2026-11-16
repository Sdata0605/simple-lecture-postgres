import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseUrl";

// The browser's IANA time zone, used for "today" and the study-plan days on the server.
export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
};

// GET one dashboard part from the backend: /functions/v1/dashboard/<path>?<params>.
export async function dashboardGet<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_PUBLISHABLE_KEY;
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
  ).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dashboard/${path}${qs ? `?${qs}` : ""}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`dashboard/${path} failed with ${res.status}`);
  return (await res.json()) as T;
}
