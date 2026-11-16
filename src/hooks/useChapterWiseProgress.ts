import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mcLog } from "@/lib/debug/myCoursesLogger";
import { inBatches } from "@/lib/batchIn";

export interface ChapterDetailedProgress {
  id: string;
  name: string;
  subjectId: string;
  subjectName: string;
  overallProgress: number;
  lectures: { watched: number; total: number };
  dpps: { solved: number; total: number };
  tests: { completed: number; total: number };
  pyqs: { completed: number; total: number };
  proficiency: { completed: number; total: number };
}

export interface CourseWithChapterProgress {
  id: string;
  name: string;
  subjects: {
    id: string;
    name: string;
    chapters: ChapterDetailedProgress[];
  }[];
}

export const useChapterWiseProgress = (courseIds: string[]) => {
  const keyIds = [...courseIds].sort().join(',');
  mcLog('useChapter', 'hook-call', { courseIdsCount: courseIds.length, keyIds });
  const q = useQuery({
    queryKey: ['chapter-wise-progress', keyIds],
    queryFn: async () => {
      const startedAt = performance.now();
      mcLog('useChapter', 'queryFn:start', { keyIds, reason: 'NETWORK CALL — cache miss or stale' });
      if (!courseIds.length) return [];

      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // 2. Fetch course subjects with chapters and topics
      const courseSubjects = await inBatches(courseIds, async (chunk) => {
        const { data } = await supabase
          .from('course_subjects')
        .select(`
          course_id,
          popular_subjects (
            id,
            name,
            subject_chapters (
              id,
              title,
              sequence_order,
              video_id,
              video_platform,
              ai_generated_video_url,
              ai_presentation_json,
              subject_topics (
                id,
                title,
                video_id,
                video_platform,
                ai_generated_video_url,
                ai_presentation_json
              )
            )
          )
        `)
          .in('course_id', chunk);
        return data;
      });

      if (!courseSubjects?.length) return [];

      // Get all subject IDs and chapter IDs
      const subjectIds: string[] = [];
      const chapterIds: string[] = [];
      const topicIds: string[] = [];

      courseSubjects.forEach((cs: any) => {
        const subject = Array.isArray(cs.popular_subjects) 
          ? cs.popular_subjects[0] 
          : cs.popular_subjects;
        if (!subject) return;
        
        subjectIds.push(subject.id);
        (subject.subject_chapters || []).forEach((ch: any) => {
          chapterIds.push(ch.id);
          (ch.subject_topics || []).forEach((t: any) => {
            topicIds.push(t.id);
          });
        });
      });

      // 3. Fetch all required data in parallel
      const [
        videoJobsResult,
        topicVideosResult,
        dppQuestionsResult,
        dppSubmissionsResult,
        testsResult,
        testResultsResult,
        papersResult,
        paperResultsResult,
        watchLogsResult
      ] = await Promise.all([
        // Published AI lecture jobs: one chunked query per id list (was a single .or() string with both lists,
        // which could exceed the proxy's URL limit), merged and de-duplicated by job id.
        (async () => {
          const byChapter = await inBatches(chapterIds, async (chunk) => {
            const { data } = await (supabase as any)
              .from('video_generation_jobs')
              .select('id, chapter_id, topic_id')
              .eq('is_published', true)
              .in('chapter_id', chunk);
            return data;
          });
          const byTopic = await inBatches(topicIds, async (chunk) => {
            const { data } = await (supabase as any)
              .from('video_generation_jobs')
              .select('id, chapter_id, topic_id')
              .eq('is_published', true)
              .in('topic_id', chunk);
            return data;
          });
          const merged = new Map<string, any>();
          [...byChapter, ...byTopic].forEach((job: any) => merged.set(job.id, job));
          return { data: Array.from(merged.values()) };
        })(),
        
        // Additional topic videos
        inBatches(topicIds, async (chunk) => {
          const { data } = await supabase
            .from('topic_videos')
            .select('id, topic_id')
            .in('topic_id', chunk);
          return data;
        }).then((data) => ({ data })),
        
        // DPP questions (to count topics with DPPs)
        inBatches(chapterIds, async (chunk) => {
          const { data } = await supabase
            .from('dpp_questions')
            .select('id, topic_id, chapter_id')
            .in('chapter_id', chunk);
          return data;
        }).then((data) => ({ data })),
        
        // DPP submissions
        inBatches(topicIds, async (chunk) => {
          const { data } = await supabase
            .from('dpp_topic_submissions')
            .select('topic_id')
            .eq('student_id', user.id)
            .in('topic_id', chunk);
          return data;
        }).then((data) => ({ data })),
        
        // Practice tests linked to chapters
        inBatches(chapterIds, async (chunk) => {
          const { data } = await supabase
            .from('tests')
            .select('id, chapter_id')
            .in('chapter_id', chunk);
          return data;
        }).then((data) => ({ data })),
        
        // Test results for practice tests
        supabase
          .from('test_results')
          .select('test_id')
          .eq('student_id', user.id),
        
        // PYQ and Proficiency papers
        inBatches(subjectIds, async (chunk) => {
          const { data } = await supabase
            .from('subject_previous_year_papers')
            .select('id, subject_id, paper_category')
            .in('subject_id', chunk);
          return data;
        }).then((data) => ({ data })),
        
        // Paper test results
        supabase
          .from('paper_test_results')
          .select('paper_id')
          .eq('student_id', user.id),
        
        // Video watch logs (for lectures watched)
        supabase
          .from('ai_video_watch_logs')
          .select('chapter_id, topic_id')
          .eq('student_id', user.id)
          .gte('completion_percentage', 80)
      ]);

      // Build lookup maps
      const publishedJobsByChapter = new Map<string, number>();
      const publishedJobsByTopic = new Map<string, number>();
      (videoJobsResult.data || []).forEach((job: any) => {
        if (job.chapter_id) {
          publishedJobsByChapter.set(job.chapter_id, (publishedJobsByChapter.get(job.chapter_id) || 0) + 1);
        }
        if (job.topic_id) {
          publishedJobsByTopic.set(job.topic_id, (publishedJobsByTopic.get(job.topic_id) || 0) + 1);
        }
      });

      const topicVideosByTopic = new Map<string, number>();
      (topicVideosResult.data || []).forEach((tv: any) => {
        topicVideosByTopic.set(tv.topic_id, (topicVideosByTopic.get(tv.topic_id) || 0) + 1);
      });

      const topicsWithDPP = new Set<string>();
      (dppQuestionsResult.data || []).forEach((q: any) => {
        if (q.topic_id) topicsWithDPP.add(q.topic_id);
      });

      const solvedDPPTopics = new Set<string>();
      (dppSubmissionsResult.data || []).forEach((s: any) => {
        solvedDPPTopics.add(s.topic_id);
      });

      const testsByChapter = new Map<string, string[]>();
      (testsResult.data || []).forEach((t: any) => {
        if (!testsByChapter.has(t.chapter_id)) {
          testsByChapter.set(t.chapter_id, []);
        }
        testsByChapter.get(t.chapter_id)!.push(t.id);
      });

      const completedTestIds = new Set<string>();
      (testResultsResult.data || []).forEach((r: any) => {
        completedTestIds.add(r.test_id);
      });

      const pyqsBySubject = new Map<string, string[]>();
      const proficiencyBySubject = new Map<string, string[]>();
      (papersResult.data || []).forEach((p: any) => {
        if (p.paper_category === 'previous_year') {
          if (!pyqsBySubject.has(p.subject_id)) {
            pyqsBySubject.set(p.subject_id, []);
          }
          pyqsBySubject.get(p.subject_id)!.push(p.id);
        } else if (p.paper_category === 'proficiency') {
          if (!proficiencyBySubject.has(p.subject_id)) {
            proficiencyBySubject.set(p.subject_id, []);
          }
          proficiencyBySubject.get(p.subject_id)!.push(p.id);
        }
      });

      const completedPaperIds = new Set<string>();
      (paperResultsResult.data || []).forEach((r: any) => {
        completedPaperIds.add(r.paper_id);
      });

      const watchedChapters = new Set<string>();
      const watchedTopics = new Set<string>();
      (watchLogsResult.data || []).forEach((log: any) => {
        if (log.chapter_id) watchedChapters.add(log.chapter_id);
        if (log.topic_id) watchedTopics.add(log.topic_id);
      });

      // 4. Build course data with chapter progress
      const coursesMap: Record<string, CourseWithChapterProgress> = {};

      // Get course names from a quick query
      const courses = await inBatches(courseIds, async (chunk) => {
        const { data } = await supabase
          .from('courses')
          .select('id, name')
          .in('id', chunk);
        return data;
      });

      (courses || []).forEach((c: any) => {
        coursesMap[c.id] = {
          id: c.id,
          name: c.name,
          subjects: []
        };
      });

      // Calculate progress for each chapter
      courseSubjects.forEach((cs: any) => {
        const subject = Array.isArray(cs.popular_subjects) 
          ? cs.popular_subjects[0] 
          : cs.popular_subjects;
        
        if (!subject || !coursesMap[cs.course_id]) return;

        const subjectPYQs = pyqsBySubject.get(subject.id) || [];
        const subjectProficiency = proficiencyBySubject.get(subject.id) || [];

        const chapters: ChapterDetailedProgress[] = (subject.subject_chapters || []).map((chapter: any) => {
          const topics = chapter.subject_topics || [];
          const chapterTopicIds = topics.map((t: any) => t.id);

          // Calculate lectures
          let totalLectures = 0;
          let watchedLectures = 0;

          // Chapter-level lectures
          const chapterAIJobs = publishedJobsByChapter.get(chapter.id) || 0;
          if (chapterAIJobs > 0) {
            totalLectures += chapterAIJobs;
          } else if (chapter.ai_generated_video_url || chapter.ai_presentation_json) {
            totalLectures += 1;
          }
          if (chapter.video_id && chapter.video_platform) {
            totalLectures += 1;
          }

          // Topic-level lectures
          topics.forEach((topic: any) => {
            const topicAIJobs = publishedJobsByTopic.get(topic.id) || 0;
            if (topicAIJobs > 0) {
              totalLectures += topicAIJobs;
            } else if (topic.ai_generated_video_url || topic.ai_presentation_json) {
              totalLectures += 1;
            }
            if (topic.video_id && topic.video_platform) {
              totalLectures += 1;
            }
          });

          // Additional topic videos
          chapterTopicIds.forEach((tid: string) => {
            totalLectures += topicVideosByTopic.get(tid) || 0;
          });

          // Watched lectures (simplified: count chapter + topic watches)
          if (watchedChapters.has(chapter.id)) watchedLectures += 1;
          chapterTopicIds.forEach((tid: string) => {
            if (watchedTopics.has(tid)) watchedLectures += 1;
          });
          // Cap at total
          watchedLectures = Math.min(watchedLectures, totalLectures);

          // Calculate DPPs
          const chapterDPPTopics = chapterTopicIds.filter((tid: string) => topicsWithDPP.has(tid));
          const totalDPPs = chapterDPPTopics.length;
          const solvedDPPs = chapterDPPTopics.filter((tid: string) => solvedDPPTopics.has(tid)).length;

          // Calculate Tests
          const chapterTestIds = testsByChapter.get(chapter.id) || [];
          const totalTests = chapterTestIds.length;
          const completedTests = chapterTestIds.filter((tid: string) => completedTestIds.has(tid)).length;

          // Calculate PYQs (subject-level, distributed per chapter)
          const totalPYQs = subjectPYQs.length;
          const completedPYQs = subjectPYQs.filter((pid: string) => completedPaperIds.has(pid)).length;

          // Calculate Proficiency (subject-level)
          const totalProficiency = subjectProficiency.length;
          const completedProficiency = subjectProficiency.filter((pid: string) => completedPaperIds.has(pid)).length;

          // Calculate overall progress (weighted average of components with content)
          let totalWeight = 0;
          let weightedSum = 0;

          if (totalLectures > 0) {
            totalWeight += 1;
            weightedSum += (watchedLectures / totalLectures);
          }
          if (totalDPPs > 0) {
            totalWeight += 1;
            weightedSum += (solvedDPPs / totalDPPs);
          }
          if (totalTests > 0) {
            totalWeight += 1;
            weightedSum += (completedTests / totalTests);
          }
          if (totalPYQs > 0) {
            totalWeight += 0.5; // Lower weight for subject-level items
            weightedSum += 0.5 * (completedPYQs / totalPYQs);
          }
          if (totalProficiency > 0) {
            totalWeight += 0.5;
            weightedSum += 0.5 * (completedProficiency / totalProficiency);
          }

          const overallProgress = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

          return {
            id: chapter.id,
            name: chapter.title,
            subjectId: subject.id,
            subjectName: subject.name,
            overallProgress,
            lectures: { watched: watchedLectures, total: totalLectures },
            dpps: { solved: solvedDPPs, total: totalDPPs },
            tests: { completed: completedTests, total: totalTests },
            pyqs: { completed: completedPYQs, total: totalPYQs },
            proficiency: { completed: completedProficiency, total: totalProficiency }
          };
        }).sort((a: ChapterDetailedProgress, b: ChapterDetailedProgress) => 
          (a.name || '').localeCompare(b.name || '')
        );

        coursesMap[cs.course_id].subjects.push({
          id: subject.id,
          name: subject.name,
          chapters
        });
      });

      const result = Object.values(coursesMap);
      mcLog('useChapter', 'queryFn:done', { courses: result.length, ms: Math.round(performance.now() - startedAt) });
      return result;
    },
    enabled: courseIds.length > 0,
    staleTime: 30000
  });

  mcLog('useChapter', 'cache-state', {
    fromCache: !q.isFetching && !!q.data,
    isFetching: q.isFetching,
    isStale: q.isStale,
    ageSec: q.dataUpdatedAt ? Math.round((Date.now() - q.dataUpdatedAt) / 1000) : null,
    courses: q.data?.length ?? null,
  });

  return q;
};
