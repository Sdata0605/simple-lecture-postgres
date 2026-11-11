import { SUPABASE_DIRECT_URL, SUPABASE_URL } from '@/lib/supabaseUrl';

const DIRECT_ORIGIN = "https://oxwhqvsoelqqsblmqkxx.supabase.co";
const PROXY_ORIGIN = SUPABASE_URL;

// Course thumbnails are large originals (about 2.7 MB PNG). Pages only need a few hundred pixels, so the backend
// serves a cached, resized WebP copy of them. Other storage images are returned unchanged.
const COURSE_THUMB_PATH = "/storage/v1/object/public/course-thumbnails/";
export const COURSE_THUMB_WIDTH = 480;

function courseThumbnailSrc(url: string): string {
  if (!url.includes(COURSE_THUMB_PATH)) return url;
  return `${SUPABASE_DIRECT_URL}/functions/v1/course-thumbnail?src=${encodeURIComponent(url)}&w=${COURSE_THUMB_WIDTH}`;
}

export function rewriteStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const absolute = url.startsWith(DIRECT_ORIGIN) ? url.replace(DIRECT_ORIGIN, PROXY_ORIGIN) : url;
  return courseThumbnailSrc(absolute);
}
