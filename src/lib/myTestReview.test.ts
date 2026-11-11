import { describe, it, expect } from 'vitest';
import {
  buildQuestionReview,
  normalizeReviewOptions,
  type ReviewQuestionInput,
  type ReviewAnswerInput,
} from './myTestReview';

const mcqQ = (over: Partial<ReviewQuestionInput> = {}): ReviewQuestionInput => ({
  id: 'q1',
  order_number: 1,
  section: 'mcq',
  question_text: 'What is 2+2?',
  options: ['3', '4', '5', '6'],
  correct_answer: 'B',
  marks: 2,
  ...over,
});

describe('buildQuestionReview - MCQ', () => {
  it('marks a correct MCQ answer as correct with full marks', () => {
    const rows = buildQuestionReview(
      [mcqQ()],
      [{ self_test_question_id: 'q1', selected_option: 'B', is_correct: true, marks_awarded: 2, max_marks: 2 }],
    );
    const row = rows[0];
    expect(row.status).toBe('correct');
    expect(row.marks_awarded).toBe(2);
    expect(row.max_marks).toBe(2);
    expect(row.selected_option).toBe('B');
    expect(row.options.find((o) => o.key === 'B')).toMatchObject({ isSelected: true, isCorrect: true });
    expect(row.options.filter((o) => o.isSelected)).toHaveLength(1);
    expect(row.options.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  it('marks a wrong MCQ answer as incorrect with zero marks and shows the correct option', () => {
    const rows = buildQuestionReview(
      [mcqQ()],
      [{ self_test_question_id: 'q1', selected_option: 'C', is_correct: false, marks_awarded: 0, max_marks: 2 }],
    );
    const row = rows[0];
    expect(row.status).toBe('incorrect');
    expect(row.marks_awarded).toBe(0);
    expect(row.options.find((o) => o.key === 'C')).toMatchObject({ isSelected: true, isCorrect: false });
    expect(row.options.find((o) => o.key === 'B')).toMatchObject({ isSelected: false, isCorrect: true });
  });

  it('marks an unanswered MCQ as not_answered with zero marks and no selection', () => {
    const rows = buildQuestionReview([mcqQ()], []);
    const row = rows[0];
    expect(row.status).toBe('not_answered');
    expect(row.marks_awarded).toBe(0);
    expect(row.max_marks).toBe(2);
    expect(row.selected_option).toBeNull();
    expect(row.options.some((o) => o.isSelected)).toBe(false);
    expect(row.options.some((o) => o.isCorrect)).toBe(true);
  });

  it('treats a blank selected_option as not answered', () => {
    const rows = buildQuestionReview(
      [mcqQ()],
      [{ self_test_question_id: 'q1', selected_option: '   ', is_correct: false, marks_awarded: 0 }],
    );
    expect(rows[0].status).toBe('not_answered');
  });
});

describe('buildQuestionReview - written', () => {
  it('shows AI marks, feedback and the student answer for a graded written question', () => {
    const q: ReviewQuestionInput = {
      id: 'w1',
      order_number: 2,
      section: 'written',
      question_text: 'Explain photosynthesis.',
      options: null,
      correct_answer: 'Plants convert light into chemical energy.',
      marks: 5,
    };
    const a: ReviewAnswerInput = {
      self_test_question_id: 'w1',
      answer_text: 'Plants use sunlight to make food.',
      marks_awarded: 3,
      max_marks: 5,
      ai_feedback: 'Good start, mention chlorophyll.',
      is_correct: null,
    };
    const row = buildQuestionReview([q], [a])[0];
    expect(row.section).toBe('written');
    expect(row.status).toBe('graded');
    expect(row.marks_awarded).toBe(3);
    expect(row.max_marks).toBe(5);
    expect(row.ai_feedback).toBe('Good start, mention chlorophyll.');
    expect(row.answer_text).toBe('Plants use sunlight to make food.');
    expect(row.correct_answer).toBe('Plants convert light into chemical energy.');
    expect(row.options).toEqual([]);
  });

  it('uses extracted text when there is no typed answer, and keeps the image url', () => {
    const q: ReviewQuestionInput = { id: 'w2', order_number: 3, section: 'written', question_text: 'Q', marks: 4 };
    const a: ReviewAnswerInput = {
      self_test_question_id: 'w2',
      extracted_text: 'OCR text',
      answer_image_url: 'https://example.com/a.jpg',
      marks_awarded: 1,
      max_marks: 4,
    };
    const row = buildQuestionReview([q], [a])[0];
    expect(row.status).toBe('graded');
    expect(row.extracted_text).toBe('OCR text');
    expect(row.answer_image_url).toBe('https://example.com/a.jpg');
  });

  it('marks an unanswered written question as not_answered with zero marks', () => {
    const q: ReviewQuestionInput = { id: 'w3', order_number: 4, section: 'written', question_text: 'Q', marks: 5 };
    const row = buildQuestionReview([q], [{ self_test_question_id: 'w3', answer_text: '  ', marks_awarded: 0 }])[0];
    expect(row.status).toBe('not_answered');
    expect(row.marks_awarded).toBe(0);
    expect(row.max_marks).toBe(5);
  });
});

describe('buildQuestionReview - ordering', () => {
  it('lists every question in order_number order, numbered 1..n', () => {
    const questions: ReviewQuestionInput[] = [
      { id: 'b', order_number: 3, section: 'written', question_text: 'third', marks: 1 },
      { id: 'a', order_number: 1, section: 'mcq', question_text: 'first', options: ['x'], correct_answer: 'A', marks: 1 },
      { id: 'c', order_number: 2, section: 'mcq', question_text: 'second', options: ['x'], correct_answer: 'A', marks: 1 },
    ];
    const rows = buildQuestionReview(questions, []);
    expect(rows.map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(rows.map((r) => r.number)).toEqual([1, 2, 3]);
  });
});

describe('normalizeReviewOptions', () => {
  it('parses options given as an array of strings (keys A, B, C...)', () => {
    expect(normalizeReviewOptions(['Red', 'Blue'])).toEqual([
      { key: 'A', text: 'Red' },
      { key: 'B', text: 'Blue' },
    ]);
  });

  it('parses options given as a JSON string', () => {
    expect(normalizeReviewOptions('["Red","Blue"]')).toEqual([
      { key: 'A', text: 'Red' },
      { key: 'B', text: 'Blue' },
    ]);
  });

  it('parses an object map and a JSON string of an object map', () => {
    const expected = [
      { key: 'A', text: 'Red' },
      { key: 'B', text: 'Blue' },
    ];
    expect(normalizeReviewOptions({ A: 'Red', B: 'Blue' })).toEqual(expected);
    expect(normalizeReviewOptions('{"A":"Red","B":"Blue"}')).toEqual(expected);
  });

  it('returns an empty list for null, empty or invalid input', () => {
    expect(normalizeReviewOptions(null)).toEqual([]);
    expect(normalizeReviewOptions('')).toEqual([]);
    expect(normalizeReviewOptions('not json')).toEqual([]);
  });

  it('matches the correct option and selection when options come as a JSON string', () => {
    const q = mcqQ({ options: '["3","4","5","6"]', correct_answer: 'B' });
    const row = buildQuestionReview(
      [q],
      [{ self_test_question_id: 'q1', selected_option: 'B', is_correct: true, marks_awarded: 2, max_marks: 2 }],
    )[0];
    expect(row.options).toHaveLength(4);
    expect(row.options.find((o) => o.key === 'B')).toMatchObject({ text: '4', isCorrect: true, isSelected: true });
  });
});
