"use server";

/**
 * ユーザー管理 Server Actions
 *
 * Admin ロールのみ実行可。サーバー側で権限チェックを行う。
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { validateOperatingCompanyAssignment } from "@/lib/rbac/company-scope";
import {
  listRoles,
  listUsers,
  updateUserAccess,
  deactivateUser,
  activateUser,
  createSupabaseAuthUser,
  createUserProfile,
  resetUserPassword,
} from "@/server/repositories/users";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface UserActionResult {
  error?: string;
  success?: boolean;
}

const USERS_PATH = "/admin/users";
const SETTINGS_PATH = "/settings";

/**
 * ユーザーを新規作成する（メール + 初期パスワード + ロール + 運営会社）
 */
export async function createUserAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const email              = String(formData.get("email") ?? "").trim().toLowerCase();
  const password           = String(formData.get("password") ?? "").trim();
  const displayName        = String(formData.get("displayName") ?? "").trim();
  const roleCode           = String(formData.get("roleCode") ?? "").trim();
  const operatingCompanyId = String(formData.get("operatingCompanyId") ?? "").trim() || null;

  if (!email)       return { error: "メールアドレスを入力してください。" };
  if (!password)    return { error: "初期パスワードを入力してください。" };
  if (password.length < 8) return { error: "パスワードは8文字以上で設定してください。" };
  if (!displayName) return { error: "氏名を入力してください。" };
  if (!roleCode)    return { error: "ロールを選択してください。" };

  const roles = await listRoles();
  const role  = roles.find((r) => r.code === roleCode);
  if (!role) return { error: "指定されたロールが見つかりません。" };

  const companyValidation = validateOperatingCompanyAssignment(
    role.code,
    operatingCompanyId
  );
  if (!companyValidation.ok) {
    return { error: companyValidation.error };
  }

  let authUserId: string;
  try {
    authUserId = await createSupabaseAuthUser(email, password, displayName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ユーザーの作成に失敗しました。";
    if (msg.includes("already registered") || msg.includes("duplicate")) {
      return { error: "このメールアドレスはすでに登録されています。" };
    }
    return { error: msg };
  }

  try {
    await createUserProfile({
      authUserId,
      email,
      displayName,
      roleId: role.id,
      operatingCompanyId: companyValidation.normalizedOperatingCompanyId,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "プロフィールの作成に失敗しました。" };
  }

  await writeAuditLog({
    userId:     currentUser.id,
    action:     "user_create",
    targetType: "user_profile",
    targetId:   authUserId,
    metadata:   {
      email,
      displayName,
      roleCode,
      operatingCompanyId: companyValidation.normalizedOperatingCompanyId,
    },
  });

  revalidatePath(USERS_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
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

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const targetUserId = formData.get("userId");
  const newRoleCode  = formData.get("roleCode");
  const operatingCompanyId = String(formData.get("operatingCompanyId") ?? "").trim() || null;

  if (
    typeof targetUserId !== "string" ||
    typeof newRoleCode !== "string" ||
    !targetUserId.trim() ||
    !newRoleCode.trim()
  ) {
    return { error: "パラメータが不正です。" };
  }

  const roles = await listRoles();
  const newRole = roles.find((r) => r.code === newRoleCode);
  if (!newRole) return { error: "指定されたロールが見つかりません。" };

  const companyValidation = validateOperatingCompanyAssignment(
    newRole.code,
    operatingCompanyId
  );
  if (!companyValidation.ok) {
    return { error: companyValidation.error };
  }

  if (targetUserId === currentUser.id) {
    return { error: "自分自身のロールは変更できません。" };
  }

  const users = await listUsers();
  const targetUser = users.find((u) => u.id === targetUserId);
  const beforeRole = targetUser?.roleCode ?? "unassigned";

  await updateUserAccess(targetUserId, {
    roleId: newRole.id,
    operatingCompanyId: companyValidation.normalizedOperatingCompanyId,
  });

  await writeAuditLog({
    userId:     currentUser.id,
    action:     "user_role_change",
    targetType: "user_profile",
    targetId:   targetUserId,
    metadata:   {
      before: beforeRole,
      after: newRoleCode,
      targetEmail: targetUser?.email,
      operatingCompanyId: companyValidation.normalizedOperatingCompanyId,
    },
  });

  revalidatePath(USERS_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}

/**
 * 管理者が対象ユーザーのパスワードを再設定する
 */
export async function resetUserPasswordAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const targetUserId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!targetUserId) {
    return { error: "対象ユーザーが不正です。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で設定してください。" };
  }
  if (password !== passwordConfirm) {
    return { error: "確認用パスワードが一致しません。" };
  }

  const users = await listUsers();
  const targetUser = users.find((u) => u.id === targetUserId);
  if (!targetUser) {
    return { error: "対象ユーザーが見つかりません。" };
  }

  await resetUserPassword(targetUserId, password);

  await writeAuditLog({
    userId:     currentUser.id,
    action:     "user_password_reset",
    targetType: "user_profile",
    targetId:   targetUserId,
    metadata:   { targetEmail: targetUser.email },
  });

  revalidatePath(USERS_PATH);
  revalidatePath(SETTINGS_PATH);
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

  const users = await listUsers();
  const targetUser = users.find((u) => u.id === targetUserId);

  await deactivateUser(targetUserId);

  await writeAuditLog({
    userId:     currentUser.id,
    action:     "user_deactivate",
    targetType: "user_profile",
    targetId:   targetUserId,
    metadata:   { targetEmail: targetUser?.email },
  });

  revalidatePath(USERS_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}

/**
 * ユーザーを有効化する（停止解除）
 */
export async function activateUserAction(
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

  const users = await listUsers();
  const targetUser = users.find((u) => u.id === targetUserId);

  await activateUser(targetUserId);

  await writeAuditLog({
    userId:     currentUser.id,
    action:     "user_activate",
    targetType: "user_profile",
    targetId:   targetUserId,
    metadata:   { targetEmail: targetUser?.email },
  });

  revalidatePath(USERS_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}
