import { useQuery } from '@tanstack/react-query';
import { dashboardGet } from '@/lib/dashboardApi';

export interface ContentProgress {
  lectures: { total: number; watched: number };
  dpp: { total: number; solved: number };
  pyq: { total: number; solved: number };
  proficiency: { total: number; solved: number };
  tests: { total: number; solved: number };
}

export interface SubjectWithDetails {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  chaptersTotal: number;
  chaptersCompleted: number;
  pendingAssignments: number;
  contentProgress: ContentProgress;
  overallPercentage: number;
}

export interface CourseWithSubjects {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  subjects: SubjectWithDetails[];
}

// Shape returned by /dashboard/courses (snake_case, computed on the server).
interface CoursesResponse {
  courses: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    subjects: {
      id: string;
      name: string;
      thumbnail_url: string | null;
      chapters_total: number;
      pending_assignments: number;
      overall_percentage: number;
      progress: {
        lectures: { total: number; done: number };
        dpp: { total: number; done: number };
        pyq: { total: number; done: number };
        proficiency: { total: number; done: number };
        tests: { total: number; done: number };
      };
    }[];
  }[];
}

// Course and subject cards: one call to /dashboard/courses. The server does the counting.
export const useDashboardCourseDetails = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-course-details-v5'],
    queryFn: async (): Promise<CourseWithSubjects[]> => {
      const res = await dashboardGet<CoursesResponse>('courses');
      return (res.courses || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        thumbnail_url: c.thumbnail_url,
        subjects: c.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          description: null,
          thumbnail_url: s.thumbnail_url,
          chaptersTotal: s.chapters_total,
          chaptersCompleted: 0,
          pendingAssignments: s.pending_assignments,
          contentProgress: {
            lectures: { total: s.progress.lectures.total, watched: s.progress.lectures.done },
            dpp: { total: s.progress.dpp.total, solved: s.progress.dpp.done },
            pyq: { total: s.progress.pyq.total, solved: s.progress.pyq.done },
            proficiency: { total: s.progress.proficiency.total, solved: s.progress.proficiency.done },
            tests: { total: s.progress.tests.total, solved: s.progress.tests.done },
          },
          overallPercentage: s.overall_percentage,
        })),
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    data: data || [],
    isLoading,
  };
};
