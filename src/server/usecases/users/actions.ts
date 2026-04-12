"use server";

/**
 * ユーザー管理 Server Actions
 *
 * Admin ロールのみ実行可。サーバー側で権限チェックを行う。
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { listRoles, updateUserRole, deactivateUser } from "@/server/repositories/users";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface UserActionResult {
  error?: string;
  success?: boolean;
}

/**
 * ユーザーのロールを変更する
 */
export async function changeUserRoleAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  // 権限チェック（Admin のみ）
  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const targetUserId = formData.get("userId");
  const newRoleCode = formData.get("roleCode");

  if (
    typeof targetUserId !== "string" ||
    typeof newRoleCode !== "string" ||
    !targetUserId.trim() ||
    !newRoleCode.trim()
  ) {
    return { error: "パラメータが不正です。" };
  }

  // ロールIDを取得
  const roles = await listRoles();
  const newRole = roles.find((r) => r.code === newRoleCode);
  if (!newRole) return { error: "指定されたロールが見つかりません。" };

  // 自分自身のロールは変更不可
  if (targetUserId === currentUser.id) {
    return { error: "自分自身のロールは変更できません。" };
  }

  // 現在のロールを取得して before/after を記録
  const { listUsers } = await import("@/server/repositories/users");
  const users = await listUsers();
  const targetUser = users.find((u) => u.id === targetUserId);
  const beforeRole = targetUser?.roleCode ?? "unknown";

  await updateUserRole(targetUserId, newRole.id);

  await writeAuditLog({
    userId: currentUser.id,
    action: "user_role_change",
    targetType: "user_profile",
    targetId: targetUserId,
    metadata: {
      before: beforeRole,
      after: newRoleCode,
      targetEmail: targetUser?.email,
    },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * ユーザーを無効化する
 */
export async function deactivateUserAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const targetUserId = formData.get("userId");

  if (typeof targetUserId !== "string" || !targetUserId.trim()) {
    return { error: "パラメータが不正です。" };
  }

  if (targetUserId === currentUser.id) {
    return { error: "自分自身を無効化することはできません。" };
  }

  const { listUsers } = await import("@/server/repositories/users");
  const users = await listUsers();
  const targetUser = users.find((u) => u.id === targetUserId);

  await deactivateUser(targetUserId);

  await writeAuditLog({
    userId: currentUser.id,
    action: "user_deactivate",
    targetType: "user_profile",
    targetId: targetUserId,
    metadata: { targetEmail: targetUser?.email },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
