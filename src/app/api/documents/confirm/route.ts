/**
 * POST /api/documents/confirm
 *
 * Storage へのアップロード完了後にメタデータをDBへ登録する。
 * アップロードURLを取得した内部ユーザーまたはトークン経由の外部ユーザーが呼び出す。
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { registerDocument, getUploadToken } from "@/server/repositories/documents";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/types/documents";
import type { ConfirmUploadRequest } from "@/types/documents";

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

export async function POST(req: NextRequest) {
  let body: Partial<ConfirmUploadRequest> & { uploadToken?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const {
    storagePath,
    originalFilename,
    mimeType,
    fileSize,
    caseId,
    organizationId,
    documentTypeId,
    participantId,
    documentRequirementId,
    replacedDocumentId,
    uploadToken,
  } = body;

  if (!storagePath || !originalFilename || !mimeType || !fileSize || !caseId || !organizationId || !documentTypeId) {
    return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
  }

  // MIME / サイズ再検証
  if (!ALLOWED_MIME_SET.has(mimeType)) {
    return NextResponse.json({ error: "許可されていないファイル形式です" }, { status: 422 });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "ファイルサイズが上限を超えています" }, { status: 422 });
  }

  let uploadedByUserId: string | null = null;
  let uploadTokenId: string | null = null;

  if (uploadToken) {
    // 顧客向けトークン認証
    const tokenRecord = await getUploadToken(uploadToken).catch(() => null);
    if (!tokenRecord) {
      return NextResponse.json({ error: "無効なアップロードトークンです" }, { status: 403 });
    }
    if (!tokenRecord.isActive) {
      return NextResponse.json({ error: "このリンクは無効化されています" }, { status: 403 });
    }
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      return NextResponse.json({ error: "アップロードリンクの有効期限が切れています" }, { status: 403 });
    }
    if (tokenRecord.caseId !== caseId || tokenRecord.organizationId !== organizationId) {
      return NextResponse.json({ error: "案件情報が一致しません" }, { status: 403 });
    }
    // 外部提出: uploaded_by_user_id は NULL、upload_token_id でトレース
    uploadedByUserId = null;
    uploadTokenId = tokenRecord.id;
  } else {
    // 内部ユーザー認証
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    uploadedByUserId = user.id;
  }

  try {
    const document = await registerDocument(
      {
        storagePath,
        originalFilename,
        mimeType,
        fileSize,
        caseId,
        organizationId,
        documentTypeId,
        participantId,
        documentRequirementId,
        replacedDocumentId,
      },
      uploadedByUserId,
      uploadTokenId
    );

    // 監査ログ（内部ユーザーのみ記録）
    if (!uploadToken) {
      await writeAuditLog({
        userId:     uploadedByUserId,
        action:     replacedDocumentId ? "document_replace" : "document_upload",
        targetType: "document",
        targetId:   document.id,
        metadata:   {
          caseId,
          originalFilename,
          mimeType,
          fileSize,
          versionNo: document.versionNo,
        },
      });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("[documents/confirm] error:", err);
    return NextResponse.json(
      { error: "書類の登録に失敗しました" },
      { status: 500 }
    );
  }
}
