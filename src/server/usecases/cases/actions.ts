"use server";

/**
 * 案件 Server Actions
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, can, PERMISSIONS } from "@/lib/rbac";
import { createCase, updateCase, updateCaseStatus, deleteCase } from "@/server/repositories/cases";
import { syncCaseVideoCourses, getVideoCourse } from "@/server/repositories/video-courses";
import { getSubsidyProgram } from "@/server/repositories/subsidy-programs";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { generateInitialTasks } from "@/server/services/cases";
import { resolveOperatingCompanyId } from "@/server/repositories/operating-companies";
import {
  expandChecklistItems,
  expandCompanyDocumentRequirements,
} from "@/server/services/template-expansion";
import {
  getOptionalFeatureUnavailableMessage,
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/errors";
import type { CaseStatus } from "@/lib/constants/case-status";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * 案件表示名を合成する。
 * video_courses.display_template が設定されている場合はそれを使用。
 * テンプレート変数: {abbreviation}, {program}, {course}
 * デフォルト: "{abbreviation} / {course}"
 */
function buildCaseName(
  programName: string,
  programAbbreviation: string | null,
  courseName: string,
  displayTemplate: string | null
): string {
  const abbr = programAbbreviation ?? programName;
  const template = displayTemplate ?? "{abbreviation} / {course}";
  return template
    .replace("{abbreviation}", abbr)
    .replace("{program}", programName)
    .replace("{course}", courseName);
}

function validateProgramAndCourse(
  subsidyProgramId: string,
  courseSubsidyProgramId: string | null
): string | null {
  if (!courseSubsidyProgramId) {
    return "選択されたコースに助成金種別が設定されていません。コースマスタを確認してください。";
  }
  if (courseSubsidyProgramId !== subsidyProgramId) {
    return "選択されたコースは助成金種別に紐付いていません。もう一度選択してください。";
  }
  return null;
}

function getCaseActionErrorMessage(error: unknown, fallback: string): string {
  if (
    isMissingSupabaseColumnError(error, ["operating_company_id"]) ||
    isMissingSupabaseRelationError(error, ["operating_companies"])
  ) {
    return getOptionalFeatureUnavailableMessage("運営会社");
  }

  const message = error instanceof Error ? error.message : fallback;
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("generate_case_code") ||
    normalizedMessage.includes("cases_assign_case_code") ||
    normalizedMessage.includes("auth_can_access_company") ||
    (normalizedMessage.includes("case_code") &&
      normalizedMessage.includes("null value"))
  ) {
    return getOptionalFeatureUnavailableMessage("運営会社");
  }

  return message;
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

  const organizationId      = String(formData.get("organizationId") ?? "").trim();
  const operatingCompanyIdRaw = String(formData.get("operatingCompanyId") ?? "").trim();
  const subsidyProgramId    = String(formData.get("subsidyProgramId") ?? "").trim() || undefined;
  const videoCourseId       = String(formData.get("videoCourseId") ?? "").trim() || undefined;
  const contractDate        = String(formData.get("contractDate") ?? "").trim() || undefined;
  const plannedStartDate    = String(formData.get("plannedStartDate") ?? "").trim() || undefined;
  const plannedEndDate      = String(formData.get("plannedEndDate") ?? "").trim() || undefined;
  const preApplicationDueDate   = String(formData.get("preApplicationDueDate") ?? "").trim() || undefined;
  const finalApplicationDueDate = String(formData.get("finalApplicationDueDate") ?? "").trim() || undefined;
  const ownerUserId         = String(formData.get("ownerUserId") ?? "").trim() || undefined;
  const summary             = String(formData.get("summary") ?? "").trim() || undefined;

  if (!organizationId)        return { error: "顧客企業を選択してください。" };
  if (!operatingCompanyIdRaw) return { error: "運営会社を選択してください。" };
  if (!subsidyProgramId)      return { error: "助成金種別を選択してください。" };
  if (!videoCourseId)         return { error: "コースを選択してください。" };

  let operatingCompanyId: string;
  try {
    const resolvedOperatingCompanyId = await resolveOperatingCompanyId(
      operatingCompanyIdRaw
    );
    if (!resolvedOperatingCompanyId) {
      return {
        error:
          "運営会社の選択値を確認できませんでした。画面を再読み込みしてもう一度お試しください。",
      };
    }
    operatingCompanyId = resolvedOperatingCompanyId;
  } catch (error) {
    return {
      error: getCaseActionErrorMessage(error, "運営会社の確認に失敗しました。"),
    };
  }

  // 助成金種別・コース名を取得して案件名を合成
  const [program, course] = await Promise.all([
    getSubsidyProgram(subsidyProgramId),
    getVideoCourse(videoCourseId),
  ]);
  if (!program) return { error: "選択された助成金種別が存在しません。" };
  if (!course)  return { error: "選択されたコースが存在しません。" };

  const validationError = validateProgramAndCourse(
    subsidyProgramId,
    course.subsidyProgramId
  );
  if (validationError) return { error: validationError };

  const caseName = buildCaseName(
    program.name,
    program.abbreviation,
    course.name,
    course.displayTemplate
  );

  let newCase;
  try {
    newCase = await createCase({
      organizationId,
      operatingCompanyId,
      caseName,
      subsidyProgramId,
      videoCourseId,
      contractDate,
      plannedStartDate,
      plannedEndDate,
      preApplicationDueDate,
      finalApplicationDueDate,
      ownerUserId,
      summary,
      createdBy: user.id,
    });

    // 中間テーブルも単一コースで同期（後方互換）
    await syncCaseVideoCourses(newCase.id, [videoCourseId], user.id);

    // 初期タスク自動生成
    await generateInitialTasks(newCase.id, plannedStartDate);

    // チェックリスト・書類要件テンプレート展開
    await expandChecklistItems(newCase.id, subsidyProgramId);
    await expandCompanyDocumentRequirements(newCase.id, subsidyProgramId);

  } catch (err) {
    console.error("[createCaseAction]", err);
    return {
      error: getCaseActionErrorMessage(err, "案件の作成に失敗しました。"),
    };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_create",
    targetType: "cases",
    targetId:   newCase.id,
    metadata:   { caseName, caseCode: newCase.caseCode, organizationId, operatingCompanyId },
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

  try {
    requirePermission(user.roleCode, PERMISSIONS.CASE_EDIT);
  } catch {
    return { error: "この操作を行う権限がありません。" };
  }

  const caseId          = String(formData.get("caseId") ?? "").trim();
  const subsidyProgramId = String(formData.get("subsidyProgramId") ?? "").trim() || undefined;
  const videoCourseId    = String(formData.get("videoCourseId") ?? "").trim() || undefined;

  if (!caseId)           return { error: "案件IDが不正です。" };
  if (!subsidyProgramId) return { error: "助成金種別を選択してください。" };
  if (!videoCourseId)    return { error: "コースを選択してください。" };

  // 案件名を再合成
  const [program, course] = await Promise.all([
    getSubsidyProgram(subsidyProgramId),
    getVideoCourse(videoCourseId),
  ]);
  if (!program) return { error: "選択された助成金種別が存在しません。" };
  if (!course)  return { error: "選択されたコースが存在しません。" };

  const validationError = validateProgramAndCourse(
    subsidyProgramId,
    course.subsidyProgramId
  );
  if (validationError) return { error: validationError };

  const caseName = buildCaseName(
    program.name,
    program.abbreviation,
    course.name,
    course.displayTemplate
  );

  const input = {
    caseName,
    subsidyProgramId,
    videoCourseId,
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
    // 中間テーブルも単一コースで同期（後方互換）
    await syncCaseVideoCourses(caseId, [videoCourseId], user.id);
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
