import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { SUPABASE_DIRECT_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabaseUrl";
import {
  LOGIN_PROBLEM_MESSAGE,
  invokeAiTeachingAssistantDirect,
  startAiTeachingAssistantJob,
} from "./invokeAiTeachingAssistant";

const FUNCTION_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-assistant`;
const JOBS_URL = `${FUNCTION_URL}/jobs`;
const JOB_URL = `${JOBS_URL}/job-1`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const accepted = () => json(202, { jobId: "job-1" });

const poll = (stage: string, extra: Record<string, unknown> = {}) =>
  json(200, {
    jobId: "job-1",
    stage,
    attempt: 1,
    maxAttempts: 3,
    elapsedSec: 4,
    startedAt: "2026-11-05T10:00:00Z",
    finishedAt: stage === "done" || stage === "failed" ? "2026-11-05T10:00:05Z" : null,
    ...extra,
  });

const done = (result: unknown) => poll("done", { result });

const bearerOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization;
const methodOf = (call: unknown[]) => (call[1] as RequestInit).method;

describe("invokeAiTeachingAssistantDirect (async job)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    auth.getSession.mockReset();
    auth.refreshSession.mockReset();
    auth.getSession.mockResolvedValue({ data: { session: null } });
    // Default: POST accepted, polls keep reporting "waiting" (fresh Response each time).
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
      init.method === "POST" ? accepted() : poll("waiting"),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the public anon key as the bearer token when nobody is signed in", async () => {
    fetchMock.mockResolvedValueOnce(accepted()).mockResolvedValueOnce(done({ answer: "a salt" }));

    const promise = invokeAiTeachingAssistantDirect({ question: "What is a salt?" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ data: { answer: "a salt" }, error: null });
    expect(fetchMock.mock.calls[0][0]).toBe(JOBS_URL);
    expect(methodOf(fetchMock.mock.calls[0])).toBe("POST");
    expect(bearerOf(fetchMock.mock.calls[0])).toBe(`Bearer ${SUPABASE_PUBLISHABLE_KEY}`);
    expect(bearerOf(fetchMock.mock.calls[1])).toBe(`Bearer ${SUPABASE_PUBLISHABLE_KEY}`);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ question: "What is a salt?" });
  });

  it("POSTs once, polls the job URL until done, and returns the result", async () => {
    const onProgress = vi.fn();
    fetchMock
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(poll("validating"))
      .mockResolvedValueOnce(poll("contacting", { attempt: 2 }))
      .mockResolvedValueOnce(done({ answer: "ok" }));

    const promise = invokeAiTeachingAssistantDirect({ question: "q" }, { onProgress });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ data: { answer: "ok" }, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(methodOf(fetchMock.mock.calls[0])).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toBe(JOB_URL);
    expect(methodOf(fetchMock.mock.calls[1])).toBe("GET");
    expect(onProgress.mock.calls.map(c => c[0].stage)).toEqual(["validating", "contacting", "done"]);
    expect(onProgress).toHaveBeenNthCalledWith(2, { stage: "contacting", attempt: 2, maxAttempts: 3, elapsedSec: 4 });
  });

  it("returns a 'done' result that carries an error or blocked flag as data, not as an error", async () => {
    fetchMock.mockResolvedValueOnce(accepted()).mockResolvedValueOnce(done({ blocked: true, message: "off topic" }));

    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({ data: { blocked: true, message: "off topic" }, error: null });
  });

  it("fails with the backend message and code when the job stage is failed", async () => {
    fetchMock.mockResolvedValueOnce(accepted()).mockResolvedValueOnce(
      poll("failed", { error: { code: "upstream_error", message: "Model overloaded", retryable: true } }),
    );

    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({
      data: null,
      error: { message: "Model overloaded", code: "upstream_error", retryable: true, status: 200 },
    });
  });

  it("fails with job_not_found when the poll returns 404", async () => {
    fetchMock.mockResolvedValueOnce(accepted()).mockResolvedValueOnce(
      json(404, { error: { code: "job_not_found", message: "Job expired", retryable: false } }),
    );

    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.data).toEqual({ error: { code: "job_not_found", message: "Job expired", retryable: false } });
    expect(result.error).toEqual({ message: "Job expired", status: 404, code: "job_not_found", retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tolerates a network error on one poll and keeps polling", async () => {
    fetchMock
      .mockResolvedValueOnce(accepted())
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(done({ answer: "recovered" }));

    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({ data: { answer: "recovered" }, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up with a friendly network error after 5 consecutive poll failures", async () => {
    fetchMock.mockResolvedValueOnce(accepted());
    for (let i = 0; i < 5; i++) fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({
      data: null,
      error: {
        message: "We could not reach the AI tutor. Check your connection and try again.",
        code: "network",
        retryable: true,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("cancel stops polling and resolves with code cancelled", async () => {
    const handle = startAiTeachingAssistantJob({ question: "q" });
    await vi.advanceTimersByTimeAsync(4000);
    const callsBefore = fetchMock.mock.calls.length;

    handle.cancel();
    const result = await handle.promise;
    await vi.advanceTimersByTimeAsync(60_000);

    expect(result).toEqual({
      data: null,
      error: { message: "Cancelled", code: "cancelled", retryable: false },
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("an external AbortSignal cancels the job", async () => {
    const controller = new AbortController();
    const promise = invokeAiTeachingAssistantDirect({ question: "q" }, { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(2000);

    controller.abort();

    expect((await promise).error?.code).toBe("cancelled");
  });

  it("fails with code timeout when the client deadline (430 s) passes", async () => {
    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.advanceTimersByTimeAsync(430_000);

    expect(await promise).toEqual({
      data: null,
      error: { message: "The AI tutor took too long to answer. Please ask again.", code: "timeout", retryable: true },
    });
  });

  it("refreshes the session once and retries the POST when the gateway rejects an expired token", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "old-token" } } });
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } }, error: null });
    fetchMock
      .mockResolvedValueOnce(json(401, { code: "UNAUTHORIZED_INVALID_JWT_FORMAT", message: "Invalid JWT" }))
      .mockResolvedValueOnce(accepted())
      .mockResolvedValueOnce(done({ answer: "ok" }));

    const promise = invokeAiTeachingAssistantDirect({ question: "q" });
    await vi.runAllTimersAsync();

    expect(await promise).toEqual({ data: { answer: "ok" }, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(bearerOf(fetchMock.mock.calls[0])).toBe("Bearer old-token");
    expect(bearerOf(fetchMock.mock.calls[1])).toBe("Bearer new-token");
    expect(methodOf(fetchMock.mock.calls[1])).toBe("POST");
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("explains a login problem in plain words when the retried POST is still rejected", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "old-token" } } });
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "new-token" } }, error: null });
    fetchMock.mockResolvedValue(json(401, { code: "UNAUTHORIZED_INVALID_JWT_FORMAT", message: "Invalid JWT" }));

    const result = await invokeAiTeachingAssistantDirect({ question: "q" });

    expect(result.data).toEqual({ code: "UNAUTHORIZED_INVALID_JWT_FORMAT", message: "Invalid JWT" });
    expect(result.error).toEqual({ message: LOGIN_PROBLEM_MESSAGE, status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the session cannot be refreshed", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "old-token" } } });
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("refresh token revoked") });
    fetchMock.mockResolvedValue(json(401, { message: "Invalid JWT" }));

    const result = await invokeAiTeachingAssistantDirect({ question: "q" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.error).toEqual({ message: LOGIN_PROBLEM_MESSAGE, status: 401 });
  });

  it("does not try to refresh for a visitor with no session", async () => {
    fetchMock.mockResolvedValue(json(401, { message: "Invalid JWT" }));

    const result = await invokeAiTeachingAssistantDirect({ question: "q" });

    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.error?.status).toBe(401);
  });

  it("passes the backend's error message and code through when the POST is rejected with 400", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { error: { code: "invalid_request", message: "question is required", retryable: false } }),
    );

    const result = await invokeAiTeachingAssistantDirect({});

    expect(result.error).toEqual({
      message: "question is required",
      status: 400,
      code: "invalid_request",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes a plain string error message through for other POST failures", async () => {
    fetchMock.mockResolvedValueOnce(json(502, { error: "Upstream timed out after 420s", attempts: 3 }));

    const result = await invokeAiTeachingAssistantDirect({ question: "q" });

    expect(result.error).toEqual({ message: "Upstream timed out after 420s", status: 502 });
  });

  it("falls back to the HTTP status when the POST body has no message", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await invokeAiTeachingAssistantDirect({ question: "q" });

    expect(result.error).toEqual({ message: "HTTP 500", status: 500 });
  });

  it("reports a network failure on the POST without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await invokeAiTeachingAssistantDirect({ question: "q" });

    expect(result).toEqual({
      data: null,
      error: { message: "Failed to fetch", code: "network", retryable: true },
    });
  });
});
