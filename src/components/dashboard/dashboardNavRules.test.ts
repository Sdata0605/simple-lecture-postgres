import { describe, it, expect } from "vitest";
import { GUEST_MENU_ROUTES, isGuestVisibleMenuItem, isMenuRouteActive } from "./dashboardNavRules";

describe("isGuestVisibleMenuItem", () => {
  it("shows only Browse Courses, Forum, Blog and Support to guests", () => {
    expect(GUEST_MENU_ROUTES).toEqual(["/programs", "/forum", "/blog", "/support"]);
    expect(isGuestVisibleMenuItem("/programs")).toBe(true);
    expect(isGuestVisibleMenuItem("/forum")).toBe(true);
    expect(isGuestVisibleMenuItem("/blog")).toBe(true);
    expect(isGuestVisibleMenuItem("/support")).toBe(true);
  });

  it("hides signed-in-only routes and non-link entries", () => {
    expect(isGuestVisibleMenuItem("/dashboard")).toBe(false);
    expect(isGuestVisibleMenuItem("/my-courses")).toBe(false);
    expect(isGuestVisibleMenuItem("/timetable")).toBe(false);
    expect(isGuestVisibleMenuItem("/my-tests")).toBe(false);
    expect(isGuestVisibleMenuItem("/my-notes")).toBe(false);
    expect(isGuestVisibleMenuItem("/profile")).toBe(false);
    expect(isGuestVisibleMenuItem(null)).toBe(false);
    expect(isGuestVisibleMenuItem(undefined)).toBe(false);
  });
});

describe("isMenuRouteActive", () => {
  it("matches the exact route", () => {
    expect(isMenuRouteActive("/forum", "/forum")).toBe(true);
  });

  it("highlights the parent for sub-routes", () => {
    expect(isMenuRouteActive("/forum/post/x", "/forum")).toBe(true);
    expect(isMenuRouteActive("/blog/my-slug", "/blog")).toBe(true);
  });

  it("does not match a different route that only shares a prefix", () => {
    expect(isMenuRouteActive("/forums", "/forum")).toBe(false);
    expect(isMenuRouteActive("/blogger", "/blog")).toBe(false);
  });

  it("does not match unrelated routes", () => {
    expect(isMenuRouteActive("/support", "/forum")).toBe(false);
    expect(isMenuRouteActive("/", "/forum")).toBe(false);
  });
});
