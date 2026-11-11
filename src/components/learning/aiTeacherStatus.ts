// Pure helpers for showing the real AI tutor request status while the user waits.
// No React and no side effects, so they can be unit tested directly.

export interface AiTeacherStatusInput {
  stage?: string | null;
  attempt?: number | null;
  maxAttempts?: number | null;
}

/** Maps the job stage reported by the server to user-facing text. */
export function getAiTeacherStageLabel(input: AiTeacherStatusInput | null | undefined): string {
  const stage = input?.stage ?? '';
  switch (stage) {
    case 'validating':
      return 'Checking the AI tutor connection';
    case 'contacting':
      return 'Sending your question to the AI tutor';
    case 'waiting':
      return 'The AI tutor is preparing your answer';
    case 'retrying': {
      const attempt = input?.attempt;
      const max = input?.maxAttempts;
      if (typeof attempt === 'number' && typeof max === 'number' && attempt > 0 && max > 0) {
        return `Retrying (attempt ${attempt} of ${max})`;
      }
      return 'Retrying your question';
    }
    case 'received':
    case 'done':
      return 'Answer received, preparing the slides';
    case 'failed':
      return 'The request failed';
    default:
      return 'Sending your question to the AI tutor';
  }
}

/** Formats a number of seconds as m:ss (for example 0:05, 1:30, 12:01). */
export function formatElapsedClock(seconds: number | null | undefined): string {
  const safe = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const PREPARATION_FAILED_FALLBACK =
  'Something went wrong while preparing your answer. Please try again.';
