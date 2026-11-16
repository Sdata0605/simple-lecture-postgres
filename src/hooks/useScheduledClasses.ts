import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { inBatches } from '@/lib/batchIn';
import { useStudentCourseIds } from './useStudentEnrollments';

export interface ScheduledClass {
  id: string;
  subject: string;
  room_number: string | null;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  notes: string | null;
  is_cancelled: boolean;
  teacher: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export const useScheduledClasses = () => {
  const { courseIds, isLoading: enrollmentsLoading } = useStudentCourseIds();

  const { data: classes, isLoading: queryLoading } = useQuery({
    queryKey: ['scheduled-classes', courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];

      const now = new Date().toISOString();
      // Each chunk keeps .order().limit(10); merged rows are re-sorted and cut to the first 10
      const classesData = (await inBatches(courseIds, async (chunk) => {
        const { data, error } = await supabase
          .from('scheduled_classes')
          .select('*')
          .in('course_id', chunk)
          .gte('scheduled_at', now)
          .eq('is_cancelled', false)
          .order('scheduled_at', { ascending: true })
          .limit(10);

        if (error) throw error;
        return data;
      }))
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        .slice(0, 10);
      if (!classesData || classesData.length === 0) return [];

      // Get teacher profiles in batch
      const teacherIds = [...new Set(classesData.map(c => c.teacher_id).filter(Boolean))] as string[];

      let teacherProfiles: any[] = [];
      if (teacherIds.length > 0) {
        teacherProfiles = await inBatches(teacherIds, async (chunk) => {
          const { data: teachers } = await supabase
            .from('teacher_profiles')
            .select('id, full_name, avatar_url')
            .in('id', chunk);
          return teachers;
        });
      }

      // Map teachers to classes
      return classesData.map(classItem => ({
        ...classItem,
        teacher: teacherProfiles.find(t => t.id === classItem.teacher_id) || null,
      }));
    },
    enabled: courseIds.length > 0,
  });

  return {
    classes: classes || [],
    isLoading: enrollmentsLoading || queryLoading,
  };
};
