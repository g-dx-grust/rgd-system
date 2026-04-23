"use server";

/**
 * 社労士専用 Server Actions
 *
 * ログイン / ログアウト / 提出完了記録 / 最終申請完了マーク
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { SPECIALIST_HOME_PATH, SPECIALIST_LOGIN_PATH } from "@/lib/auth/access-routes";
import { writeAuditLog } from "@/server/repositories/audit-log";
import {
  recordSpecialistSubmission,
  markSpecialistFinalComplete,
} from "@/server/repositories/specialist";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// ログイン（社労士専用）
// ---------------------------------------------------------------

export async function specialistLoginAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email    = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    await writeAuditLog({
      userId:   null,
      action:   "login_failed",
      metadata: { email: email.trim(), reason: error.message, via: "specialist_portal" },
    });
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  // ロール確認（external_specialist のみ許可）
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("is_active, roles ( code )")
    .eq("id", data.user.id)
    .single();

  const roleCode = (() => {
    const r = profileData?.roles;
    if (!r) return null;
    return Array.isArray(r) ? (r[0] as { code?: string })?.code : (r as { code?: string })?.code;
  })();

  if (roleCode !== "external_specialist") {
    await supabase.auth.signOut();
    await writeAuditLog({
      userId:   data.user.id,
      action:   "login_failed",
      metadata: { email: email.trim(), reason: "not_specialist_role", roleCode },
    });
    return { error: "このページへのアクセス権限がありません。" };
  }

  if (!profileData?.is_active) {
    await supabase.auth.signOut();
    return { error: "アカウントが無効化されています。管理者にお問い合わせください。" };
  }

  await writeAuditLog({
    userId:   data.user.id,
    action:   "login",
    metadata: { email: data.user.email, via: "specialist_portal" },
  });

  redirect(SPECIALIST_HOME_PATH);
}

// ---------------------------------------------------------------
// ログアウト
// ---------------------------------------------------------------

export async function specialistLogoutAction(): Promise<void> {
  const profile  = await getCurrentUserProfile();
  const supabase = await createClient();

  if (profile) {
    await writeAuditLog({
      userId:   profile.id,
      action:   "logout",
      metadata: { via: "specialist_portal" },
    });
  }

  await supabase.auth.signOut();
  redirect(SPECIALIST_LOGIN_PATH);
}

// ---------------------------------------------------------------
// 提出完了記録
// ---------------------------------------------------------------

export async function recordSubmissionAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist") {
    return { error: "権限がありません。" };
  }

  const caseId           = formData.get("caseId");
  const submittedAt      = formData.get("submittedAt");
  const submissionMethod = formData.get("submissionMethod");

  if (
    typeof caseId !== "string" || !caseId ||
    typeof submittedAt !== "string" || !submittedAt ||
    typeof submissionMethod !== "string" || !submissionMethod.trim()
  ) {
    return { error: "提出日時と提出方法を入力してください。" };
  }

  const result = await recordSpecialistSubmission({
    caseId,
    specialistUserId: profile.id,
    submittedAt,
    submissionMethod: submissionMethod.trim(),
  });

  if (!result.ok) {
    return { error: "記録に失敗しました。再度お試しください。" };
  }

  await writeAuditLog({
    userId:     profile.id,
    action:     "specialist_submission_record",
    targetType: "case",
    targetId:   caseId,
    metadata:   { submittedAt, submissionMethod: submissionMethod.trim() },
  });

  return { success: true };
}

// ---------------------------------------------------------------
// 最終申請完了マーク
// ---------------------------------------------------------------

export async function markFinalCompleteAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist") {
    return { error: "権限がありません。" };
  }

  const caseId = formData.get("caseId");
  if (typeof caseId !== "string" || !caseId) {
    return { error: "案件IDが不正です。" };
  }

  const result = await markSpecialistFinalComplete({
    caseId,
    specialistUserId: profile.id,
  });

  if (!result.ok) {
    return { error: "完了マークに失敗しました。再度お試しください。" };
  }

  await writeAuditLog({
    userId:     profile.id,
    action:     "specialist_final_complete",
    targetType: "case",
    targetId:   caseId,
  });

  return { success: true };
}
