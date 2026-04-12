"use server";

/**
 * 書類管理 Server Actions
 *
 * 差戻し / 承認 / 要件追加 / 論理削除
 */

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import {
  updateDocumentReviewStatus,
  softDeleteDocument,
  createRequirement,
  listDocumentTypes,
  createUploadToken as repoCreateUploadToken,
} from "@/server/repositories/documents";
import { writeAuditLog } from "@/server/repositories/audit-log";
import type { ReturnReason } from "@/types/documents";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ------------------------------------------------------------
// 差戻し
// ------------------------------------------------------------

export async function returnDocumentAction(
  documentId: string,
  returnReason: ReturnReason,
  returnReasonDetail?: string,
  caseId?: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    await updateDocumentReviewStatus({
      documentId,
      reviewStatus: "returned",
      returnReason,
      returnReasonDetail,
    });

    await writeAuditLog({
      userId:     user.id,
      action:     "document_return",
      targetType: "document",
      targetId:   documentId,
      metadata:   { returnReason, returnReasonDetail, caseId },
    });

    if (caseId) {
      revalidatePath(`/cases/${caseId}/documents`);
      revalidatePath(`/cases/${caseId}`);
    }
    return { success: true };
  } catch (err) {
    console.error("[returnDocument] error:", err);
    return { error: "差戻し処理に失敗しました" };
  }
}

// ------------------------------------------------------------
// 承認
// ------------------------------------------------------------

export async function approveDocumentAction(
  documentId: string,
  caseId?: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    await updateDocumentReviewStatus({
      documentId,
      reviewStatus: "approved",
    });

    await writeAuditLog({
      userId:     user.id,
      action:     "document_upload",  // audit には「承認」の専用アクションがないため upload を流用
      targetType: "document",
      targetId:   documentId,
      metadata:   { action: "approved", caseId },
    });

    if (caseId) {
      revalidatePath(`/cases/${caseId}/documents`);
      revalidatePath(`/cases/${caseId}`);
    }
    return { success: true };
  } catch (err) {
    console.error("[approveDocument] error:", err);
    return { error: "承認処理に失敗しました" };
  }
}

// ------------------------------------------------------------
// 書類要件追加
// ------------------------------------------------------------

export async function addRequirementAction(params: {
  caseId:          string;
  documentTypeId:  string;
  participantId?:  string;
  requiredFlag?:   boolean;
  dueDate?:        string;
  note?:           string;
}): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    await createRequirement({
      caseId:          params.caseId,
      documentTypeId:  params.documentTypeId,
      participantId:   params.participantId,
      requiredFlag:    params.requiredFlag ?? true,
      dueDate:         params.dueDate,
      note:            params.note,
    });

    revalidatePath(`/cases/${params.caseId}/documents`);
    revalidatePath(`/cases/${params.caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[addRequirement] error:", err);
    return { error: "書類要件の追加に失敗しました" };
  }
}

// ------------------------------------------------------------
// 書類論理削除
// ------------------------------------------------------------

export async function deleteDocumentAction(
  documentId: string,
  caseId: string
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    await softDeleteDocument(documentId);

    await writeAuditLog({
      userId:     user.id,
      action:     "document_delete",
      targetType: "document",
      targetId:   documentId,
      metadata:   { caseId },
    });

    revalidatePath(`/cases/${caseId}/documents`);
    revalidatePath(`/cases/${caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteDocument] error:", err);
    return { error: "書類の削除に失敗しました" };
  }
}

// ------------------------------------------------------------
// 顧客向けアップロードリンク発行
// ------------------------------------------------------------

export async function issueUploadTokenAction(params: {
  caseId:         string;
  organizationId: string;
  expiresDays?:   number;
  note?:          string;
}): Promise<{ token?: string; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  const days = params.expiresDays ?? 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const token = await repoCreateUploadToken({
      caseId:          params.caseId,
      organizationId:  params.organizationId,
      createdByUserId: user.id,
      expiresAt,
      note:            params.note,
    });

    return { token };
  } catch (err) {
    console.error("[issueUploadToken] error:", err);
    return { error: "アップロードリンクの発行に失敗しました" };
  }
}

// ------------------------------------------------------------
// 書類種別一覧取得
// ------------------------------------------------------------

export async function fetchDocumentTypesAction() {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です", types: [] };

  try {
    const types = await listDocumentTypes();
    return { types };
  } catch (err) {
    console.error("[fetchDocumentTypes] error:", err);
    return { error: "書類種別の取得に失敗しました", types: [] };
  }
}
