"use server";

/**
 * 受理日登録 Server Action
 *
 * 受理日を登録し、受理後タスクを自動生成する。
 * ステータス変更は自動遷移せず、遷移候補をUIに提示する（CLAUDE.md ルール）。
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { generatePostAcceptanceTasks } from "@/server/services/cases";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// 受理日登録
// ---------------------------------------------------------------
export async function registerAcceptanceDateAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CASE_EDIT);

  const caseId        = String(formData.get("caseId") ?? "").trim();
  const acceptanceDate = String(formData.get("acceptanceDate") ?? "").trim();

  if (!caseId)         return { error: "案件IDが不正です。" };
  if (!acceptanceDate) return { error: "受理日を入力してください。" };

  // 日付フォーマット検証
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(acceptanceDate)) return { error: "受理日の形式が正しくありません（例: 2026-04-01）。" };

  const supabase = await createClient();

  // 既に受理日が登録済みかチェック
  const { data: existing } = await supabase
    .from("cases")
    .select("id, acceptance_date")
    .eq("id", caseId)
    .is("deleted_at", null)
    .single();

  if (!existing) return { error: "案件が見つかりません。" };

  try {
    // 受理日を更新
    const { error } = await supabase
      .from("cases")
      .update({ acceptance_date: acceptanceDate })
      .eq("id", caseId)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);

    // 受理後タスクを自動生成（既に生成済みでも重複生成しない設計は task_templates に委ねる）
    // 初回登録時のみ生成する
    if (!existing.acceptance_date) {
      await generatePostAcceptanceTasks(caseId, acceptanceDate);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "受理日の登録に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_update",
    targetType: "cases",
    targetId:   caseId,
    metadata:   { acceptanceDate, trigger: "acceptance_date_register" },
  });

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}
