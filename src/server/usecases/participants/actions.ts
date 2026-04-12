"use server";

/**
 * 受講者 Server Actions
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  createParticipant,
  bulkCreateParticipants,
  updateParticipant,
  deleteParticipant,
} from "@/server/repositories/participants";
import { writeAuditLog } from "@/server/repositories/audit-log";
import type { CreateParticipantInput } from "@/server/repositories/participants";
import type { LearnerStatus } from "@/lib/constants/case-status";

export interface ActionResult {
  error?: string;
  success?: boolean;
  insertedCount?: number;
}

// ---------------------------------------------------------------
// 受講者追加（1件）
// ---------------------------------------------------------------
export async function createParticipantAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.TRAINEE_EDIT);

  const caseId = String(formData.get("caseId") ?? "").trim();
  const name   = String(formData.get("name") ?? "").trim();
  if (!caseId) return { error: "案件IDが不正です。" };
  if (!name)   return { error: "氏名を入力してください。" };

  try {
    await createParticipant({
      caseId,
      name,
      nameKana:       String(formData.get("nameKana") ?? "").trim() || undefined,
      employeeCode:   String(formData.get("employeeCode") ?? "").trim() || undefined,
      email:          String(formData.get("email") ?? "").trim() || undefined,
      department:     String(formData.get("department") ?? "").trim() || undefined,
      employmentType: String(formData.get("employmentType") ?? "").trim() || undefined,
      joinedAt:       String(formData.get("joinedAt") ?? "").trim() || undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "受講者の追加に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "trainee_update",
    targetType: "participants",
    targetId:   caseId,
    metadata:   { name, action: "create" },
  });

  revalidatePath(`/cases/${caseId}/participants`);
  return { success: true };
}

// ---------------------------------------------------------------
// 受講者一括登録（CSV）
// ---------------------------------------------------------------
export interface CsvParticipantRow {
  name: string;
  nameKana?: string;
  employeeCode?: string;
  email?: string;
  department?: string;
  employmentType?: string;
  joinedAt?: string;
}

export async function bulkCreateParticipantsAction(
  caseId: string,
  rows: CsvParticipantRow[]
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.TRAINEE_EDIT);

  if (!caseId) return { error: "案件IDが不正です。" };
  if (rows.length === 0) return { error: "データが空です。" };
  if (rows.length > 500) return { error: "一度に登録できる受講者は500名までです。" };

  // 氏名が必須
  const invalid = rows.filter((r) => !r.name?.trim());
  if (invalid.length > 0) {
    return { error: "氏名が空の行があります。確認してください。" };
  }

  const inputs: Omit<CreateParticipantInput, "caseId">[] = rows.map((r) => ({
    name:           r.name.trim(),
    nameKana:       r.nameKana?.trim() || undefined,
    employeeCode:   r.employeeCode?.trim() || undefined,
    email:          r.email?.trim() || undefined,
    department:     r.department?.trim() || undefined,
    employmentType: r.employmentType?.trim() || undefined,
    joinedAt:       r.joinedAt?.trim() || undefined,
    learnerStatus:  "planned" as LearnerStatus,
  }));

  let insertedCount = 0;
  try {
    insertedCount = await bulkCreateParticipants(caseId, inputs);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "一括登録に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "trainee_update",
    targetType: "participants",
    targetId:   caseId,
    metadata:   { action: "bulk_create", count: insertedCount },
  });

  revalidatePath(`/cases/${caseId}/participants`);
  return { success: true, insertedCount };
}

// ---------------------------------------------------------------
// 受講者ステータス変更
// ---------------------------------------------------------------
export async function updateParticipantStatusAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.TRAINEE_EDIT);

  const participantId  = String(formData.get("participantId") ?? "").trim();
  const caseId         = String(formData.get("caseId") ?? "").trim();
  const learnerStatus  = String(formData.get("learnerStatus") ?? "").trim() as LearnerStatus;
  const excludedReason = String(formData.get("excludedReason") ?? "").trim() || undefined;

  if (!participantId) return { error: "受講者IDが不正です。" };
  if (!learnerStatus) return { error: "ステータスを選択してください。" };

  try {
    await updateParticipant(participantId, { learnerStatus, excludedReason });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "更新に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/participants`);
  return { success: true };
}

// ---------------------------------------------------------------
// 受講者削除（論理削除）
// ---------------------------------------------------------------
export async function deleteParticipantAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.TRAINEE_EDIT);

  const participantId = String(formData.get("participantId") ?? "").trim();
  const caseId        = String(formData.get("caseId") ?? "").trim();
  if (!participantId) return { error: "受講者IDが不正です。" };

  try {
    await deleteParticipant(participantId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "削除に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/participants`);
  return { success: true };
}
