// Pure data mapping for the "Question review" section of the My Test Result page.
// Combines self-test questions with the student's saved answers into display rows.

export type ReviewSection = 'mcq' | 'written';
export type ReviewStatus = 'correct' | 'incorrect' | 'not_answered' | 'graded';

export interface ReviewQuestionInput {
  id: string;
  order_number: number;
  section: ReviewSection | string;
  question_text: string;
  options?: unknown;
  correct_answer?: string | null;
  marks?: number | null;
}

export interface ReviewAnswerInput {
  self_test_question_id: string;
  selected_option?: string | null;
  answer_text?: string | null;
  answer_image_url?: string | null;
  is_correct?: boolean | null;
  marks_awarded?: number | null;
  max_marks?: number | null;
  ai_feedback?: string | null;
  extracted_text?: string | null;
}

export interface ReviewOption {
  key: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
}

export interface QuestionReviewRow {
  id: string;
  number: number;
  section: ReviewSection;
  question_text: string;
  status: ReviewStatus;
  marks_awarded: number;
  max_marks: number;
  options: ReviewOption[];
  selected_option: string | null;
  correct_answer: string | null;
  answer_text: string | null;
  extracted_text: string | null;
  answer_image_url: string | null;
  ai_feedback: string | null;
}

const norm = (s: unknown): string => (s == null ? '' : String(s)).trim().toLowerCase();

const optionText = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'text' in v) return String((v as { text?: unknown }).text ?? '');
  return JSON.stringify(v ?? '');
};

/**
 * Normalises MCQ options into { key, text } pairs.
 * Accepts an array of strings, an array of { key?, text } objects, an object map
 * ({ A: '...' }), or any of these serialised as a JSON string.
 * Array items without a key are labelled A, B, C, ... by position.
 */
export function normalizeReviewOptions(raw: unknown): { key: string; text: string }[] {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item: unknown, i: number) => ({
      key: item && typeof item === 'object' && (item as { key?: unknown }).key != null
        ? String((item as { key: unknown }).key)
        : String.fromCharCode(65 + i),
      text: optionText(item),
    }));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      text: optionText(v),
    }));
  }
  return [];
}

/** Builds one review row from a question and its answer (answer may be missing). */
export function buildQuestionReviewRow(
  q: ReviewQuestionInput,
  a: ReviewAnswerInput | undefined,
  number: number,
): QuestionReviewRow {
  const section: ReviewSection = q.section === 'mcq' ? 'mcq' : 'written';
  const max_marks = Number(a?.max_marks ?? q.marks ?? 1);
  const correctAnswer = q.correct_answer ? String(q.correct_answer) : null;
  const selected = a?.selected_option != null && String(a.selected_option).trim() !== ''
    ? String(a.selected_option)
    : null;

  const base = {
    id: q.id,
    number,
    section,
    question_text: q.question_text ?? '',
    max_marks,
    correct_answer: correctAnswer,
    answer_text: a?.answer_text?.trim() ? a.answer_text : null,
    extracted_text: a?.extracted_text?.trim() ? a.extracted_text : null,
    answer_image_url: a?.answer_image_url || null,
    ai_feedback: a?.ai_feedback || null,
  };

  if (section === 'mcq') {
    const options: ReviewOption[] = normalizeReviewOptions(q.options).map((o) => ({
      key: o.key,
      text: o.text,
      isCorrect: correctAnswer !== null && (norm(o.key) === norm(correctAnswer) || norm(o.text) === norm(correctAnswer)),
      isSelected: selected !== null && (norm(o.key) === norm(selected) || norm(o.text) === norm(selected)),
    }));

    if (selected === null) {
      return { ...base, status: 'not_answered', marks_awarded: 0, options, selected_option: null };
    }

    const isCorrect = correctAnswer !== null
      ? norm(selected) === norm(correctAnswer)
      : a?.is_correct === true;
    const marks_awarded = isCorrect ? Number(a?.marks_awarded ?? max_marks) : 0;

    return {
      ...base,
      status: isCorrect ? 'correct' : 'incorrect',
      marks_awarded,
      options,
      selected_option: selected,
    };
  }

  const hasWritten = base.answer_text !== null || base.extracted_text !== null || base.answer_image_url !== null;
  if (!hasWritten) {
    return {
      ...base,
      status: 'not_answered',
      marks_awarded: 0,
      options: [],
      selected_option: null,
    };
  }

  return {
    ...base,
    status: 'graded',
    marks_awarded: Number(a?.marks_awarded ?? 0),
    options: [],
    selected_option: null,
  };
}

/** Builds review rows for all questions, in order_number order. */
export function buildQuestionReview(
  questions: ReviewQuestionInput[],
  answers: ReviewAnswerInput[],
): QuestionReviewRow[] {
  const ansBy = new Map<string, ReviewAnswerInput>();
  answers.forEach((a) => ansBy.set(a.self_test_question_id, a));

  return [...questions]
    .sort((x, y) => Number(x.order_number) - Number(y.order_number))
    .map((q, i) => buildQuestionReviewRow(q, ansBy.get(q.id), i + 1));
}
