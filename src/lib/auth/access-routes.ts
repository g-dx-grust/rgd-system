import type { RoleCode } from "@/lib/rbac";

export const INTERNAL_LOGIN_PATH = "/login";
export const INTERNAL_HOME_PATH = "/dashboard";
export const SPECIALIST_LOGIN_PATH = "/external/specialist/login";
export const SPECIALIST_HOME_PATH = "/external/specialist/cases";

export function isSpecialistRole(role: RoleCode | null | undefined): boolean {
  return role === "external_specialist";
}

export function getHomePathForRole(role: RoleCode | null | undefined): string {
  return isSpecialistRole(role) ? SPECIALIST_HOME_PATH : INTERNAL_HOME_PATH;
}

export function getLoginPathForRole(role: RoleCode | null | undefined): string {
  return isSpecialistRole(role) ? SPECIALIST_LOGIN_PATH : INTERNAL_LOGIN_PATH;
}
