"use server";

/**
 * 証憑管理 Server Actions
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  createEvidenceItem,
  updateEvidenceItem,
  deleteEvidenceItem,
} from "@/server/repositories/evidence-items";
import type { EvidenceType, EvidenceStatus } from "@/server/repositories/evidence-items";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// 証憑作成
// ---------------------------------------------------------------
export async function createEvidenceItemAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.DOCUMENT_UPLOAD);

  const caseId        = String(formData.get("caseId") ?? "").trim();
  const title         = String(formData.get("title") ?? "").trim();
  const evidenceType  = String(formData.get("evidenceType") ?? "other").trim() as EvidenceType;
  const participantId = String(formData.get("participantId") ?? "").trim() || undefined;
  const dueDate       = String(formData.get("dueDate") ?? "").trim() || undefined;
  const note          = String(formData.get("note") ?? "").trim() || undefined;

  if (!caseId) return { error: "案件IDが不正です。" };
  if (!title)  return { error: "証憑名を入力してください。" };

  const validTypes: EvidenceType[] = ['receipt', 'payslip', 'attendance', 'completion', 'other'];
  if (!validTypes.includes(evidenceType)) return { error: "不正な証憑種別です。" };

  try {
    await createEvidenceItem({ caseId, participantId, evidenceType, title, dueDate, note, createdBy: user.id });

    await writeAuditLog({
      userId:     user.id,
      action:     "document_upload",
      targetType: "evidence_items",
      metadata:   { title, evidenceType, caseId, action: "created" },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "証憑の登録に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/evidence`);
  return { success: true };
}

// ---------------------------------------------------------------
// 証憑ステータス更新
// ---------------------------------------------------------------
export async function updateEvidenceStatusAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.DOCUMENT_UPLOAD);

  const caseId       = String(formData.get("caseId") ?? "").trim();
  const evidenceId   = String(formData.get("evidenceId") ?? "").trim();
  const status       = String(formData.get("status") ?? "").trim() as EvidenceStatus;

  if (!caseId || !evidenceId || !status) return { error: "パラメータが不正です。" };

  const validStatuses: EvidenceStatus[] = ['pending', 'collected', 'insufficient', 'confirmed'];
  if (!validStatuses.includes(status)) return { error: "不正なステータスです。" };

  const now = new Date().toISOString();
  const updates: Parameters<typeof updateEvidenceItem>[1] = { status };

  if (status === "collected") {
    updates.collectedAt = now;
  } else if (status === "confirmed") {
    updates.confirmedAt = now;
  }

  try {
    await updateEvidenceItem(evidenceId, updates);

    await writeAuditLog({
      userId:     user.id,
      action:     "document_upload",
      targetType: "evidence_items",
      targetId:   evidenceId,
      metadata:   { status, caseId },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "証憑ステータスの変更に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/evidence`);
  return { success: true };
}

// ---------------------------------------------------------------
// 証憑削除（論理削除）
// ---------------------------------------------------------------
export async function deleteEvidenceItemAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.DOCUMENT_UPLOAD);

  const caseId     = String(formData.get("caseId") ?? "").trim();
  const evidenceId = String(formData.get("evidenceId") ?? "").trim();

  if (!caseId || !evidenceId) return { error: "パラメータが不正です。" };

  try {
    await deleteEvidenceItem(evidenceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "証憑の削除に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/evidence`);
  return { success: true };
}
