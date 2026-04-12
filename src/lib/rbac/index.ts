/**
 * RBAC ヘルパー
 *
 * Server Component / Server Action / Route Handler から呼び出す。
 * 権限違反時は unauthorized() を使って Next.js の 401 ページを返す。
 */

import { unauthorized } from "next/navigation";
import {
  type Permission,
  type RoleCode,
  roleHasPermission,
} from "./permissions";

export { PERMISSIONS, ROLES, roleHasPermission, getPermissionsForRole } from "./permissions";
export type { Permission, RoleCode };

/**
 * ロールが権限を持つか確認する（boolean を返す版）
 */
export function can(role: RoleCode | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return roleHasPermission(role, permission);
}

/**
 * 権限がなければ 401 を返す（Server Component / Server Action 用）
 * Next.js App Router の unauthorized() を使用する。
 */
export function requirePermission(
  role: RoleCode | null | undefined,
  permission: Permission
): void {
  if (!can(role, permission)) {
    unauthorized();
  }
}

/**
 * 複数権限のいずれかを持つか確認する
 */
export function canAny(
  role: RoleCode | null | undefined,
  permissions: Permission[]
): boolean {
  if (!role) return false;
  return permissions.some((p) => roleHasPermission(role, p));
}

/**
 * 複数権限をすべて持つか確認する
 */
export function canAll(
  role: RoleCode | null | undefined,
  permissions: Permission[]
): boolean {
  if (!role) return false;
  return permissions.every((p) => roleHasPermission(role, p));
}
