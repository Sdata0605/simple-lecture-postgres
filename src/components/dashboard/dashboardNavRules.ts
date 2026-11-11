// Pure helpers for the dashboard header/menu. Kept free of React and
// Supabase imports so they can be unit tested in the node environment.

/** Menu routes a logged-out visitor may see in DashboardMenu. */
export const GUEST_MENU_ROUTES: readonly string[] = ["/programs", "/forum", "/blog", "/support"];

/**
 * Whether a menu entry is shown to a logged-out visitor.
 * `to` is null for entries that are not links (e.g. the AI Teacher action).
 */
export const isGuestVisibleMenuItem = (to: string | null | undefined): boolean =>
  to != null && GUEST_MENU_ROUTES.includes(to);

/**
 * Whether a menu link is active for the current pathname.
 * A sub-route highlights its parent: "/forum/post/x" activates "/forum".
 */
export const isMenuRouteActive = (pathname: string, to: string): boolean =>
  pathname === to || pathname.startsWith(to + "/");
