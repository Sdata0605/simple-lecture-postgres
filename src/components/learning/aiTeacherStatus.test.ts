import { describe, expect, it } from "vitest";
import { formatElapsedClock, getAiTeacherStageLabel } from "./aiTeacherStatus";

describe("getAiTeacherStageLabel", () => {
  it("maps each server stage to its label", () => {
    expect(getAiTeacherStageLabel({ stage: "validating" })).toBe("Checking the AI tutor connection");
    expect(getAiTeacherStageLabel({ stage: "contacting" })).toBe("Sending your question to the AI tutor");
    expect(getAiTeacherStageLabel({ stage: "waiting" })).toBe("The AI tutor is preparing your answer");
    expect(getAiTeacherStageLabel({ stage: "received" })).toBe("Answer received, preparing the slides");
  });

  it("includes attempt numbers when retrying", () => {
    expect(getAiTeacherStageLabel({ stage: "retrying", attempt: 2, maxAttempts: 4 })).toBe("Retrying (attempt 2 of 4)");
    expect(getAiTeacherStageLabel({ stage: "retrying" })).toBe("Retrying your question");
  });

  it("falls back to a neutral label for unknown or missing stages", () => {
    expect(getAiTeacherStageLabel(null)).toBe("Sending your question to the AI tutor");
    expect(getAiTeacherStageLabel({ stage: "something-new" })).toBe("Sending your question to the AI tutor");
  });
});

describe("formatElapsedClock", () => {
  it("formats seconds as m:ss", () => {
    expect(formatElapsedClock(0)).toBe("0:00");
    expect(formatElapsedClock(5)).toBe("0:05");
    expect(formatElapsedClock(90)).toBe("1:30");
    expect(formatElapsedClock(601.9)).toBe("10:01");
  });

  it("treats invalid input as zero", () => {
    expect(formatElapsedClock(-3)).toBe("0:00");
    expect(formatElapsedClock(NaN)).toBe("0:00");
    expect(formatElapsedClock(undefined)).toBe("0:00");
  });
});
