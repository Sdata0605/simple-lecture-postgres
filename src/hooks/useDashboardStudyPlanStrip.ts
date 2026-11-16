import { useQuery } from '@tanstack/react-query';
import { dashboardGet, browserTimeZone } from '@/lib/dashboardApi';
import type { StudySession } from './useStudyTimetable';

export interface DaySessionsRow {
  sessions: StudySession[];
  courseNameById: Map<string, string>;
}

export interface SessionTitles {
  subject: Map<string, string>;
  chapter: Map<string, string>;
  topic: Map<string, string>;
}

// One session as returned by /dashboard/study-plan (joined names included).
interface StudyPlanRow extends StudySession {
  course_name: string | null;
  subject_name: string | null;
  chapter_title: string | null;
  topic_title: string | null;
}

interface StudyPlanResponse {
  yesterday: StudyPlanRow[];
  today: StudyPlanRow[];
  tomorrow: StudyPlanRow[];
  has_enrollment: boolean;
}

// Builds the day row and the title lookups the strip uses, from the server's sessions.
const toDayRow = (rows: StudyPlanRow[]): DaySessionsRow => {
  const courseNameById = new Map<string, string>();
  const sessions: StudySession[] = rows.map((r) => {
    if (r.course_name) courseNameById.set(r.course_id, r.course_name);
    const { course_name, subject_name, chapter_title, topic_title, ...session } = r;
    return session as StudySession;
  });
  return { sessions, courseNameById };
};

export const useDashboardStudyPlanStrip = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-study-plan'],
    queryFn: () => dashboardGet<StudyPlanResponse>('study-plan', { tz: browserTimeZone() }),
    staleTime: 60_000,
  });

  const all = [...(data?.yesterday || []), ...(data?.today || []), ...(data?.tomorrow || [])];
  const titles: SessionTitles = { subject: new Map(), chapter: new Map(), topic: new Map() };
  all.forEach((r) => {
    if (r.subject_id && r.subject_name) titles.subject.set(r.subject_id, r.subject_name);
    if (r.chapter_id && r.chapter_title) titles.chapter.set(r.chapter_id, r.chapter_title);
    if (r.topic_id && r.topic_title) titles.topic.set(r.topic_id, r.topic_title);
  });

  return {
    isLoading,
    yesterday: toDayRow(data?.yesterday || []),
    today: toDayRow(data?.today || []),
    tomorrow: toDayRow(data?.tomorrow || []),
    titles,
    hasAnyEnrollment: !!data?.has_enrollment,
  };
};
