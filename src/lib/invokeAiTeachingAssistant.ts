import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_DIRECT_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseUrl";

/**
 * Client for the `ai-teaching-assistant` edge function, which runs as an async job:
 *   POST {FUNCTION_URL}/jobs        -> 202 { jobId }   (the POST is never repeated once it was accepted)
 *   GET  {FUNCTION_URL}/jobs/{id}   -> { stage, ... }  polled until stage is "done" or "failed"
 *
 * The function has `verify_jwt = true`, so the gateway answers 401 before it runs when the request carries no bearer
 * token. So:
 *   - no session  -> send the public anon key as the bearer token, as `supabase.functions.invoke` does;
 *   - 401 on the POST with a session -> refresh the session once and retry the POST (the gateway rejects before any
 *     work happens, so the retry cannot start the job twice);
 *   - still 401 -> say so in words the student can act on.
 */
const FUNCTION_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-assistant`;
const JOBS_URL = `${FUNCTION_URL}/jobs`;
const CLIENT_DEADLINE_MS = 430_000;
const FAST_POLL_MS = 1_500;
const SLOW_POLL_MS = 4_000;
const FAST_POLL_WINDOW_MS = 30_000;
const MAX_CONSECUTIVE_NETWORK_ERRORS = 5;

export const LOGIN_PROBLEM_MESSAGE = "We couldn't verify your login. Please log in again and ask your question once more.";
const NETWORK_MESSAGE = "We could not reach the AI tutor. Check your connection and try again.";
const TIMEOUT_MESSAGE = "The AI tutor took too long to answer. Please ask again.";
const CANCELLED_MESSAGE = "Cancelled";

export interface AiTeachingAssistantError {
  message: string;
  status?: number;
  code?: string;
  retryable?: boolean;
}

export interface AiTeachingAssistantResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: AiTeachingAssistantError | null;
}

export interface AiTeachingAssistantProgress {
  stage: string;
  attempt?: number;
  maxAttempts?: number;
  elapsedSec?: number;
}

export interface AiTeachingAssistantOptions {
  onProgress?: (p: AiTeachingAssistantProgress) => void;
  signal?: AbortSignal;
}

export interface AiTeachingAssistantJobHandle {
  promise: Promise<AiTeachingAssistantResult>;
  cancel: () => void;
}

const fail = (error: AiTeachingAssistantError): AiTeachingAssistantResult => ({ data: null, error });

const NETWORK_ERROR: AiTeachingAssistantError = { message: NETWORK_MESSAGE, code: "network", retryable: true };
const TIMEOUT_ERROR: AiTeachingAssistantError = { message: TIMEOUT_MESSAGE, code: "timeout", retryable: true };
const CANCELLED_ERROR: AiTeachingAssistantError = { message: CANCELLED_MESSAGE, code: "cancelled", retryable: false };

const buildHeaders = (token: string): Record<string, string> => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${token}`,
});

async function currentToken(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token ?? SUPABASE_PUBLISHABLE_KEY;
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

// Maps a non-OK response body ({ error: { code, message, retryable } } or legacy shapes) to an error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorFromResponse(status: number, data: any): AiTeachingAssistantError {
  const err = data?.error;
  const nested = err && typeof err === "object" ? err : null;
  const message =
    status === 401
      ? LOGIN_PROBLEM_MESSAGE
      : nested?.message || (typeof err === "string" && err) || data?.message || `HTTP ${status}`;
  return { message, status, code: nested?.code, retryable: nested?.retryable };
}

const isTransientStatus = (status: number) => status === 429 || status >= 500;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Starts an AI tutor job and polls it until it finishes. Returns the promise plus a `cancel` handle.
 * Cancel stops polling and resolves the promise with code "cancelled".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function startAiTeachingAssistantJob(body: any, opts: AiTeachingAssistantOptions = {}): AiTeachingAssistantJobHandle {
  const controller = new AbortController();
  let outcome: "cancelled" | "timeout" | null = null;

  const cancel = () => {
    if (outcome) return;
    outcome = "cancelled";
    controller.abort();
  };
  const onExternalAbort = () => cancel();
  if (opts.signal?.aborted) cancel();
  else opts.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const deadline = setTimeout(() => {
    if (outcome) return;
    outcome = "timeout";
    controller.abort();
  }, CLIENT_DEADLINE_MS);

  const abortedResult = (): AiTeachingAssistantResult => fail(outcome === "timeout" ? TIMEOUT_ERROR : CANCELLED_ERROR);

  const promise = runJob(body, opts.onProgress, controller.signal, abortedResult).finally(() => {
    clearTimeout(deadline);
    opts.signal?.removeEventListener("abort", onExternalAbort);
  });

  return { promise, cancel };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runJob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  onProgress: AiTeachingAssistantOptions["onProgress"],
  signal: AbortSignal,
  abortedResult: () => AiTeachingAssistantResult,
): Promise<AiTeachingAssistantResult> {
  try {
    // 1. Create the job. Retried at most once, and only for a 401 that a token refresh can fix.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session ?? null;
    const sendPost = (token: string) =>
      fetch(JOBS_URL, { method: "POST", headers: buildHeaders(token), body: JSON.stringify(body), signal });

    let res = await sendPost(session?.access_token ?? SUPABASE_PUBLISHABLE_KEY);
    if (res.status === 401 && session) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      const freshToken = refreshed?.session?.access_token;
      if (!refreshError && freshToken && freshToken !== session.access_token) {
        res = await sendPost(freshToken);
      }
    }
    if (signal.aborted) return abortedResult();

    const created = await readJson(res);
    if (!res.ok) return { data: created, error: errorFromResponse(res.status, created) };
    const jobId: unknown = created?.jobId;
    if (typeof jobId !== "string" || !jobId) {
      return fail({ message: "Unexpected response from AI tutor", status: res.status });
    }

    // 2. Poll until the job is done or failed.
    const startedAt = Date.now();
    let networkErrors = 0;
    const onTransientError = (): AiTeachingAssistantResult | null => {
      networkErrors += 1;
      return networkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS ? fail(NETWORK_ERROR) : null;
    };

    for (;;) {
      await sleep(Date.now() - startedAt < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS, signal);
      if (signal.aborted) return abortedResult();

      let pollRes: Response;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let job: any;
      try {
        const token = await currentToken();
        pollRes = await fetch(`${JOBS_URL}/${encodeURIComponent(jobId)}`, {
          method: "GET",
          headers: buildHeaders(token),
          signal,
        });
        job = await readJson(pollRes);
      } catch (err) {
        if (signal.aborted) return abortedResult();
        // A blip on one poll is not fatal; the next tick tries again.
        console.warn("[aiTutor] poll failed, retrying", err);
        const giveUp = onTransientError();
        if (giveUp) return giveUp;
        continue;
      }
      if (signal.aborted) return abortedResult();

      if (!pollRes.ok) {
        if (isTransientStatus(pollRes.status)) {
          const giveUp = onTransientError();
          if (giveUp) return giveUp;
          continue;
        }
        // 404 job_not_found (expired) and other 4xx: fail with the backend's own message.
        return { data: job, error: errorFromResponse(pollRes.status, job) };
      }
      networkErrors = 0;

      const stage: unknown = job?.stage;
      if (typeof stage !== "string") {
        const giveUp = onTransientError();
        if (giveUp) return giveUp;
        continue;
      }

      if (onProgress) {
        try {
          onProgress({
            stage,
            attempt: job.attempt,
            maxAttempts: job.maxAttempts,
            elapsedSec: job.elapsedSec,
          });
        } catch (err) {
          console.warn("[aiTutor] onProgress threw", err);
        }
      }

      if (stage === "done") {
        // The result may itself carry an `error` field or `blocked: true`; callers handle those.
        return { data: job.result ?? null, error: null };
      }
      if (stage === "failed") {
        const e = job.error ?? {};
        return {
          data: null,
          error: {
            message: e.message || "The AI tutor could not answer. Please ask again.",
            code: e.code,
            retryable: e.retryable,
            status: 200,
          },
        };
      }
    }
  } catch (err: any) {
    if (signal.aborted) return abortedResult();
    console.warn("[aiTutor] request failed", err);
    return fail({ message: err?.message || "Network error", code: "network", retryable: true });
  }
}

/**
 * Promise-only form of `startAiTeachingAssistantJob`. Keeps the previous call signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function invokeAiTeachingAssistantDirect(body: any, opts?: AiTeachingAssistantOptions): Promise<AiTeachingAssistantResult> {
  return startAiTeachingAssistantJob(body, opts).promise;
}
