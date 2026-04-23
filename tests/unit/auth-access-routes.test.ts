import { describe, expect, it } from "vitest";
import {
  getHomePathForRole,
  getLoginPathForRole,
  INTERNAL_HOME_PATH,
  INTERNAL_LOGIN_PATH,
  isSpecialistRole,
  SPECIALIST_HOME_PATH,
  SPECIALIST_LOGIN_PATH,
} from "@/lib/auth/access-routes";

describe("isSpecialistRole", () => {
  it("external_specialist のみ true を返す", () => {
    expect(isSpecialistRole("external_specialist")).toBe(true);
    expect(isSpecialistRole("admin")).toBe(false);
    expect(isSpecialistRole(null)).toBe(false);
  });
});

describe("getHomePathForRole", () => {
  it("社労士は専用ホームへ遷移する", () => {
    expect(getHomePathForRole("external_specialist")).toBe(SPECIALIST_HOME_PATH);
  });

  it("内部ロールは内部ダッシュボードへ遷移する", () => {
    expect(getHomePathForRole("operations_staff")).toBe(INTERNAL_HOME_PATH);
    expect(getHomePathForRole("admin")).toBe(INTERNAL_HOME_PATH);
    expect(getHomePathForRole(undefined)).toBe(INTERNAL_HOME_PATH);
  });
});

describe("getLoginPathForRole", () => {
  it("社労士は専用ログイン画面を返す", () => {
    expect(getLoginPathForRole("external_specialist")).toBe(SPECIALIST_LOGIN_PATH);
  });

  it("内部ロールは内部ログイン画面を返す", () => {
    expect(getLoginPathForRole("operations_manager")).toBe(INTERNAL_LOGIN_PATH);
    expect(getLoginPathForRole(null)).toBe(INTERNAL_LOGIN_PATH);
  });
});
