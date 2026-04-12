"use server";

/**
 * 最終申請 / 終了申請準備 Server Actions
 *
 * アンケート管理・チェックリスト・最終申請パッケージ作成・
 * final_application_shared → completed 遷移制御。
 */

import { revalidatePath } from "next/cache";
import { getAuthUser, getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  listSurveys,
  createSurvey,
  updateSurveyStatus,
  deleteSurvey,
} from "@/server/repositories/surveys";
import {
  listFinalReviewItems,
  createFinalReviewItem,
  toggleFinalReviewItem,
  deleteFinalReviewItem,
  initDefaultFinalReviewItems,
  listFinalSpecialistLinkages,
  createFinalSpecialistLinkage,
} from "@/server/repositories/final-review";
import { checkFinalReadiness } from "@/server/services/final-application";
import { updateCaseStatus } from "@/server/repositories/cases";
import { createApplicationPackage } from "@/server/repositories/application-packages";
import { writeAuditLog } from "@/server/repositories/audit-log";
import type {
  SurveyStatus,
  CreateSurveyInput,
  CreateFinalReviewItemInput,
  FinalReadinessResult,
  Survey,
  FinalReviewItem,
  FinalSpecialistLinkage,
} from "@/types/surveys";
import type { ApplicationPackage } from "@/types/application-packages";

export interface ActionResult {
  error?:   string;
  success?: boolean;
}

// ============================================================
// アンケート
// ============================================================

export async function fetchSurveysAction(
  caseId: string
): Promise<{ surveys?: Survey[]; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const surveys = await listSurveys(caseId);
    return { surveys };
  } catch (err) {
    console.error("[fetchSurveys] error:", err);
    return { error: "アンケート情報の取得に失敗しました" };
  }
}

export async function createSurveyAction(
  input: CreateSurveyInput
): Promise<{ surveyId?: string; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    const survey = await createSurvey(input, user.id);

    await writeAuditLog({
      userId:     user.id,
      action:     "case_update",
      targetType: "survey",
      targetId:   survey.id,
      metadata:   { caseId: input.caseId, action: "survey_created" },
    });

    revalidatePath(`/cases/${input.caseId}/completion`);
    return { surveyId: survey.id };
  } catch (err) {
    console.error("[createSurvey] error:", err);
    return { error: "アンケートの作成に失敗しました" };
  }
}

export async function updateSurveyStatusAction(params: {
  caseId:   string;
  surveyId: string;
  status:   SurveyStatus;
  sentTo?:  string;
  note?:    string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    await updateSurveyStatus(params.surveyId, params.status, {
      sentTo: params.sentTo,
      note:   params.note,
    });

    await writeAuditLog({
      userId:     user.id,
      action:     "case_update",
      targetType: "survey",
      targetId:   params.surveyId,
      metadata:   { caseId: params.caseId, status: params.status },
    });

    revalidatePath(`/cases/${params.caseId}/completion`);
    return { success: true };
  } catch (err) {
    console.error("[updateSurveyStatus] error:", err);
    return { error: "アンケートステータスの更新に失敗しました" };
  }
}

export async function deleteSurveyAction(params: {
  caseId:   string;
  surveyId: string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    await deleteSurvey(params.surveyId);

    await writeAuditLog({
      userId:     user.id,
      action:     "case_update",
      targetType: "survey",
      targetId:   params.surveyId,
      metadata:   { caseId: params.caseId, action: "survey_deleted" },
    });

    revalidatePath(`/cases/${params.caseId}/completion`);
    return { success: true };
  } catch (err) {
    console.error("[deleteSurvey] error:", err);
    return { error: "アンケートの削除に失敗しました" };
  }
}

// ============================================================
// チェックリスト
// ============================================================

export async function fetchFinalReviewItemsAction(
  caseId: string
): Promise<{ items?: FinalReviewItem[]; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const items = await listFinalReviewItems(caseId);
    return { items };
  } catch (err) {
    console.error("[fetchFinalReviewItems] error:", err);
    return { error: "チェックリストの取得に失敗しました" };
  }
}

export async function initDefaultFinalReviewItemsAction(
  caseId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    const existing = await listFinalReviewItems(caseId);
    if (existing.length > 0) {
      return { error: "チェックリストはすでに初期化済みです" };
    }

    await initDefaultFinalReviewItems(caseId, user.id);

    revalidatePath(`/cases/${caseId}/completion`);
    return { success: true };
  } catch (err) {
    console.error("[initDefaultFinalReviewItems] error:", err);
    return { error: "チェックリストの初期化に失敗しました" };
  }
}

export async function createFinalReviewItemAction(
  input: CreateFinalReviewItemInput
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    await createFinalReviewItem(input, user.id);
    revalidatePath(`/cases/${input.caseId}/completion`);
    return { success: true };
  } catch (err) {
    console.error("[createFinalReviewItem] error:", err);
    return { error: "チェック項目の作成に失敗しました" };
  }
}

export async function toggleFinalReviewItemAction(params: {
  caseId:    string;
  itemId:    string;
  isChecked: boolean;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    await toggleFinalReviewItem(params.itemId, params.isChecked, user.id);

    revalidatePath(`/cases/${params.caseId}/completion`);
    return { success: true };
  } catch (err) {
    console.error("[toggleFinalReviewItem] error:", err);
    return { error: "チェック状態の更新に失敗しました" };
  }
}

export async function deleteFinalReviewItemAction(params: {
  caseId:  string;
  itemId:  string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    await deleteFinalReviewItem(params.itemId);
    revalidatePath(`/cases/${params.caseId}/completion`);
    return { success: true };
  } catch (err) {
    console.error("[deleteFinalReviewItem] error:", err);
    return { error: "チェック項目の削除に失敗しました" };
  }
}

// ============================================================
// 完了条件チェック
// ============================================================

export async function fetchFinalReadinessAction(
  caseId: string
): Promise<{ result?: FinalReadinessResult; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const result = await checkFinalReadiness(caseId);
    return { result };
  } catch (err) {
    console.error("[fetchFinalReadiness] error:", err);
    return { error: "完了条件チェックに失敗しました" };
  }
}

// ============================================================
// 最終申請パッケージ作成
// ============================================================

export async function createFinalApplicationPackageAction(params: {
  caseId:   string;
  sharedTo?: string;
  note?:    string;
  items:    { documentId?: string; itemType: "file" | "csv" | "pdf" | "note"; label?: string; note?: string; sortOrder?: number }[];
}): Promise<{ packageId?: string; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  // 完了条件チェック
  const readiness = await checkFinalReadiness(params.caseId);
  if (!readiness.ready) {
    const missing = readiness.missingItems.map((m) => m.label).join("、");
    return { error: `完了条件を満たしていません: ${missing}` };
  }

  try {
    const pkg = await createApplicationPackage(
      {
        caseId:      params.caseId,
        packageType: "final",
        sharedTo:    params.sharedTo,
        note:        params.note,
        items:       params.items,
      },
      user.id
    );

    await writeAuditLog({
      userId:     user.id,
      action:     "specialist_package_create",
      targetType: "application_package",
      targetId:   pkg.id,
      metadata:   { caseId: params.caseId, packageType: "final" },
    });

    revalidatePath(`/cases/${params.caseId}/completion`);
    return { packageId: pkg.id };
  } catch (err) {
    console.error("[createFinalApplicationPackage] error:", err);
    return { error: "最終申請パッケージの作成に失敗しました" };
  }
}

// ============================================================
// 最終社労士連携
// ============================================================

export async function fetchFinalSpecialistLinkagesAction(
  caseId: string
): Promise<{ linkages?: FinalSpecialistLinkage[]; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const linkages = await listFinalSpecialistLinkages(caseId);
    return { linkages };
  } catch (err) {
    console.error("[fetchFinalSpecialistLinkages] error:", err);
    return { error: "連携履歴の取得に失敗しました" };
  }
}

export async function recordFinalSpecialistLinkageAction(params: {
  caseId:     string;
  packageId?: string;
  linkedTo?:  string;
  note?:      string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    const linkage = await createFinalSpecialistLinkage(
      {
        caseId:    params.caseId,
        packageId: params.packageId,
        linkedTo:  params.linkedTo,
        note:      params.note,
      },
      user.id
    );

    // 案件ステータスを final_application_shared へ進める
    await updateCaseStatus(params.caseId, "final_application_shared");

    await writeAuditLog({
      userId:     user.id,
      action:     "specialist_package_create",
      targetType: "final_specialist_linkage",
      targetId:   linkage.id,
      metadata:   {
        caseId:    params.caseId,
        toStatus:  "final_application_shared",
        linkedTo:  params.linkedTo,
        packageId: params.packageId,
      },
    });

    revalidatePath(`/cases/${params.caseId}/completion`);
    revalidatePath(`/cases/${params.caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[recordFinalSpecialistLinkage] error:", err);
    return { error: "連携記録に失敗しました" };
  }
}

// ============================================================
// final_application_shared → completed 遷移制御
// ============================================================

export async function completeCaseAction(
  caseId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE)) {
    return { error: "権限がありません" };
  }

  // 最終申請連携が存在するか確認
  const linkages = await listFinalSpecialistLinkages(caseId);
  if (linkages.length === 0) {
    return { error: "最終社労士連携が完了していません" };
  }

  // 完了条件チェック
  const readiness = await checkFinalReadiness(caseId);
  if (!readiness.ready) {
    const missing = readiness.missingItems.map((m) => m.label).join("、");
    return { error: `完了条件を満たしていません: ${missing}` };
  }

  try {
    await updateCaseStatus(caseId, "completed");

    await writeAuditLog({
      userId:     user.id,
      action:     "case_status_change",
      targetType: "case",
      targetId:   caseId,
      metadata:   { toStatus: "completed" },
    });

    revalidatePath(`/cases/${caseId}/completion`);
    revalidatePath(`/cases/${caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[completeCase] error:", err);
    return { error: "完了処理に失敗しました" };
  }
}

// ============================================================
// ページ用一括フェッチ（Server Component から呼ぶ）
// ============================================================

export async function fetchCompletionPageDataAction(caseId: string): Promise<{
  surveys?:    Survey[];
  reviewItems?: FinalReviewItem[];
  linkages?:   FinalSpecialistLinkage[];
  readiness?:  FinalReadinessResult;
  finalPackages?: ApplicationPackage[];
  error?: string;
}> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const { listApplicationPackages } = await import(
      "@/server/repositories/application-packages"
    );

    const [surveys, reviewItems, linkages, readiness, allPkgs] = await Promise.all([
      listSurveys(caseId),
      listFinalReviewItems(caseId),
      listFinalSpecialistLinkages(caseId),
      checkFinalReadiness(caseId),
      listApplicationPackages(caseId),
    ]);

    const finalPackages = allPkgs.filter((p) => p.packageType === "final");

    return { surveys, reviewItems, linkages, readiness, finalPackages };
  } catch (err) {
    console.error("[fetchCompletionPageData] error:", err);
    return { error: "データの取得に失敗しました" };
  }
}
