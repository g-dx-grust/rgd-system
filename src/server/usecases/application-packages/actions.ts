"use server";

/**
 * 申請パッケージ Server Actions
 *
 * 初回申請パッケージ作成・共有・ステータス遷移制御。
 */

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  createApplicationPackage,
  updatePackageStatus,
} from "@/server/repositories/application-packages";
import { updateCaseStatus } from "@/server/repositories/cases";
import { writeAuditLog } from "@/server/repositories/audit-log";
import {
  checkPreApplicationReadiness,
  hasReturnedDocuments,
} from "@/server/services/application-packages";
import type {
  CreateApplicationPackageItemInput,
  PreApplicationReadinessResult,
} from "@/types/application-packages";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ------------------------------------------------------------
// 初回申請可否チェック（画面表示用）
// ------------------------------------------------------------

export async function fetchPreApplicationReadinessAction(
  caseId: string
): Promise<{ result?: PreApplicationReadinessResult; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const result = await checkPreApplicationReadiness(caseId);
    return { result };
  } catch (err) {
    console.error("[fetchPreApplicationReadiness] error:", err);
    return { error: "充足チェックに失敗しました" };
  }
}

// ------------------------------------------------------------
// 初回申請パッケージ作成（ドラフト）
// ------------------------------------------------------------

export async function createPreApplicationPackageAction(params: {
  caseId:   string;
  sharedTo?: string;
  note?:    string;
  items:    CreateApplicationPackageItemInput[];
}): Promise<{ packageId?: string; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  // 充足チェック
  const readiness = await checkPreApplicationReadiness(params.caseId);
  if (!readiness.ready) {
    return { error: `必須書類が揃っていません（不足: ${readiness.insufficientRequired}件、差戻し: ${readiness.returnedCount}件）` };
  }

  try {
    const pkg = await createApplicationPackage(
      {
        caseId:      params.caseId,
        packageType: "pre",
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
      metadata:   { caseId: params.caseId, packageType: "pre" },
    });

    revalidatePath(`/cases/${params.caseId}/applications`);
    return { packageId: pkg.id };
  } catch (err) {
    console.error("[createPreApplicationPackage] error:", err);
    return { error: "パッケージ作成に失敗しました" };
  }
}

// ------------------------------------------------------------
// パッケージを共有済みにする（pre_application_shared へ遷移）
// ------------------------------------------------------------

export async function shareApplicationPackageAction(params: {
  caseId:     string;
  packageId:  string;
  sharedTo:   string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return { error: "権限がありません" };
  }

  try {
    await updatePackageStatus(params.packageId, "shared", params.sharedTo);

    // 案件ステータスを pre_application_shared に進める
    await updateCaseStatus(params.caseId, "pre_application_shared");

    await writeAuditLog({
      userId:     user.id,
      action:     "case_status_change",
      targetType: "case",
      targetId:   params.caseId,
      metadata:   {
        toStatus: "pre_application_shared",
        packageId: params.packageId,
        sharedTo:  params.sharedTo,
      },
    });

    revalidatePath(`/cases/${params.caseId}/applications`);
    revalidatePath(`/cases/${params.caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[shareApplicationPackage] error:", err);
    return { error: "共有処理に失敗しました" };
  }
}

// ------------------------------------------------------------
// 労働局受理待ち遷移（pre_application_shared → labor_office_waiting）
// ------------------------------------------------------------

export async function advanceToLaborOfficeWaitingAction(
  caseId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE)) {
    return { error: "権限がありません" };
  }

  try {
    await updateCaseStatus(caseId, "labor_office_waiting");

    await writeAuditLog({
      userId:     user.id,
      action:     "case_status_change",
      targetType: "case",
      targetId:   caseId,
      metadata:   { toStatus: "labor_office_waiting" },
    });

    revalidatePath(`/cases/${caseId}/applications`);
    revalidatePath(`/cases/${caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[advanceToLaborOfficeWaiting] error:", err);
    return { error: "ステータス変更に失敗しました" };
  }
}

// ------------------------------------------------------------
// 差戻し対応: returned ステータスへの遷移
// ------------------------------------------------------------

export async function markCaseAsReturnedAction(
  caseId: string,
  reason?: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE)) {
    return { error: "権限がありません" };
  }

  const hasReturned = await hasReturnedDocuments(caseId);
  if (!hasReturned) {
    return { error: "差戻し書類が存在しません" };
  }

  try {
    await updateCaseStatus(caseId, "returned");

    await writeAuditLog({
      userId:     user.id,
      action:     "case_status_change",
      targetType: "case",
      targetId:   caseId,
      metadata:   { toStatus: "returned", reason },
    });

    revalidatePath(`/cases/${caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[markCaseAsReturned] error:", err);
    return { error: "差戻しステータス変更に失敗しました" };
  }
}

// ------------------------------------------------------------
// 差戻し解消後に書類回収中へ戻す
// ------------------------------------------------------------

export async function resumeDocCollectingAction(
  caseId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE)) {
    return { error: "権限がありません" };
  }

  try {
    await updateCaseStatus(caseId, "doc_collecting");

    await writeAuditLog({
      userId:     user.id,
      action:     "case_status_change",
      targetType: "case",
      targetId:   caseId,
      metadata:   { toStatus: "doc_collecting", reason: "差戻し対応後に再開" },
    });

    revalidatePath(`/cases/${caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[resumeDocCollecting] error:", err);
    return { error: "ステータス変更に失敗しました" };
  }
}
