"use server";

/**
 * 案件 Server Actions
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, can, PERMISSIONS } from "@/lib/rbac";
import { createCase, updateCase, updateCaseStatus, deleteCase } from "@/server/repositories/cases";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { generateInitialTasks } from "@/server/services/cases";
import {
  expandChecklistItems,
  expandCompanyDocumentRequirements,
} from "@/server/services/template-expansion";
import type { CaseStatus } from "@/lib/constants/case-status";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// 案件作成
// ---------------------------------------------------------------
export async function createCaseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CASE_CREATE);

  const organizationId  = String(formData.get("organizationId") ?? "").trim();
  const caseName        = String(formData.get("caseName") ?? "").trim();
  const subsidyProgramId = String(formData.get("subsidyProgramId") ?? "").trim() || undefined;
  const contractDate     = String(formData.get("contractDate") ?? "").trim() || undefined;
  const plannedStartDate = String(formData.get("plannedStartDate") ?? "").trim() || undefined;
  const plannedEndDate   = String(formData.get("plannedEndDate") ?? "").trim() || undefined;
  const preApplicationDueDate   = String(formData.get("preApplicationDueDate") ?? "").trim() || undefined;
  const finalApplicationDueDate = String(formData.get("finalApplicationDueDate") ?? "").trim() || undefined;
  const ownerUserId     = String(formData.get("ownerUserId") ?? "").trim() || undefined;
  const summary         = String(formData.get("summary") ?? "").trim() || undefined;

  if (!organizationId) return { error: "顧客企業を選択してください。" };
  if (!caseName)       return { error: "案件名を入力してください。" };

  let newCase;
  try {
    newCase = await createCase({
      organizationId,
      caseName,
      subsidyProgramId,
      contractDate,
      plannedStartDate,
      plannedEndDate,
      preApplicationDueDate,
      finalApplicationDueDate,
      ownerUserId,
      summary,
      createdBy: user.id,
    });

    // 初期タスク自動生成
    await generateInitialTasks(newCase.id, plannedStartDate);

    // チェックリスト・書類要件テンプレート展開
    await expandChecklistItems(newCase.id, subsidyProgramId);
    await expandCompanyDocumentRequirements(newCase.id, subsidyProgramId);

  } catch (err) {
    console.error("[createCaseAction]", err);
    return { error: err instanceof Error ? err.message : "案件の作成に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_create",
    targetType: "cases",
    targetId:   newCase.id,
    metadata:   { caseName, caseCode: newCase.caseCode, organizationId },
  });

  redirect(`/cases/${newCase.id}`);
}

// ---------------------------------------------------------------
// 案件更新
// ---------------------------------------------------------------
export async function updateCaseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CASE_EDIT);

  const caseId  = String(formData.get("caseId") ?? "").trim();
  const caseName = String(formData.get("caseName") ?? "").trim();

  if (!caseId)   return { error: "案件IDが不正です。" };
  if (!caseName) return { error: "案件名を入力してください。" };

  const input = {
    caseName,
    subsidyProgramId:        String(formData.get("subsidyProgramId") ?? "").trim() || undefined,
    contractDate:            String(formData.get("contractDate") ?? "").trim() || undefined,
    plannedStartDate:        String(formData.get("plannedStartDate") ?? "").trim() || undefined,
    plannedEndDate:          String(formData.get("plannedEndDate") ?? "").trim() || undefined,
    preApplicationDueDate:   String(formData.get("preApplicationDueDate") ?? "").trim() || undefined,
    finalApplicationDueDate: String(formData.get("finalApplicationDueDate") ?? "").trim() || undefined,
    ownerUserId:             String(formData.get("ownerUserId") ?? "").trim() || undefined,
    summary:                 String(formData.get("summary") ?? "").trim() || undefined,
  };

  try {
    await updateCase(caseId, input);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "案件の更新に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_update",
    targetType: "cases",
    targetId:   caseId,
  });

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

// ---------------------------------------------------------------
// ステータス変更
// ---------------------------------------------------------------
export async function changeCaseStatusAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CASE_STATUS_CHANGE);

  const caseId = String(formData.get("caseId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as CaseStatus;

  if (!caseId || !status) return { error: "パラメータが不正です。" };

  try {
    await updateCaseStatus(caseId, status);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ステータス変更に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_status_change",
    targetType: "cases",
    targetId:   caseId,
    metadata:   { newStatus: status },
  });

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

// ---------------------------------------------------------------
// 案件削除（論理削除）
// ---------------------------------------------------------------
export async function deleteCaseAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  if (!can(user.roleCode, PERMISSIONS.CASE_DELETE)) {
    return { error: "この操作を行う権限がありません。" };
  }

  const caseId = String(formData.get("caseId") ?? "").trim();
  if (!caseId) return { error: "案件IDが不正です。" };

  try {
    await deleteCase(caseId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "案件の削除に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_delete",
    targetType: "cases",
    targetId:   caseId,
  });

  redirect("/cases");
}
