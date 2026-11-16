import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";

/**
 * The one place for every backend address the website uses.
 *
 * - The public API endpoint comes from VITE_LOCAL_API_URL (see supabaseUrl.ts). Change it in one env value.
 * - Upstream servers (AI teaching, Athena, avatar and video servers) are never addressed from the browser.
 *   The website only calls a backend proxy and leaves `base` empty, which means "the backend's default upstream".
 *   The real server addresses live in the backend's own env (AI_TEACHING_BASE_URL, ATHENA_BASE_URL, ...), so no
 *   server IP or port appears in this repo or in the built bundle. To point at another upstream, change the
 *   backend env, not the website code.
 */
export const FUNCTIONS_URL = `${SUPABASE_DIRECT_URL}/functions/v1`;

export const PROXY = {
  ai: `${FUNCTIONS_URL}/ai-teaching-proxy`,
  athena: `${FUNCTIONS_URL}/athena-proxy`,
  counselor: `${FUNCTIONS_URL}/counselor-avatar-proxy`,
} as const;

/** Empty string selects the backend's default upstream for a proxy. */
export const DEFAULT_UPSTREAM = "";

/** Builds a proxy URL. `base` is added only when an admin explicitly overrides the default upstream. */
export function proxyUrl(proxy: string, path: string, base: string = DEFAULT_UPSTREAM, extra?: Record<string, string>): string {
  const search = new URLSearchParams({ path });
  const cleaned = base.trim().replace(/\/+$/, "");
  if (cleaned) search.set("base", cleaned);
  for (const [k, v] of Object.entries(extra || {})) search.set(k, v);
  return `${proxy}?${search.toString()}`;
}
