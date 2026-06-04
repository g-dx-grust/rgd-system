/**
 * POST /api/specialist/cases/[id]/documents/confirm
 *
 * 社労士アップロード完了後にメタデータをDBへ登録する。
 * - external_specialist ロール かつ specialist_cases の担当（is_active）であることを確認。
 * - ファイルごとに書類要件を作成して登録するため、社内の書類タブにも独立した行として表示される。
 * - 登録後、社内スタッフへ通知する。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  getSpecialistCaseOrganizationId,
  registerSpecialistDocument,
} from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { notifyInternalStaff } from "@/server/repositories/notifications";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/types/documents";

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

const schema = z.object({
  storagePath:      z.string().min(1),
  documentTypeId:   z.string().uuid(),
  originalFilename: z.string().min(1).max(255),
  mimeType:         z.string().min(1),
  fileSize:         z.number().int().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist" || !profile.isActive) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: caseId } = await params;

  const organizationId = await getSpecialistCaseOrganizationId(caseId, profile.id);
  if (!organizationId) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
  }
  const { storagePath, documentTypeId, originalFilename, mimeType, fileSize } = parsed.data;

  if (!ALLOWED_MIME_SET.has(mimeType)) {
    return NextResponse.json({ error: "許可されていないファイル形式です" }, { status: 422 });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "ファイルサイズが上限を超えています" }, { status: 422 });
  }

  // storagePath が当該案件配下であることを検証（パス偽装防止）
  if (!storagePath.startsWith(`cases/${caseId}/`)) {
    return NextResponse.json({ error: "保存先が不正です" }, { status: 422 });
  }

  const result = await registerSpecialistDocument({
    caseId,
    organizationId,
    documentTypeId,
    storagePath,
    originalFilename,
    mimeType,
    fileSize,
    uploadedByUserId: profile.id,
  });

  if (!result.ok || !result.documentId) {
    return NextResponse.json(
      { error: result.error ?? "書類の登録に失敗しました" },
      { status: 500 }
    );
  }

  void writeAuditLog({
    userId:     profile.id,
    action:     "document_upload",
    targetType: "document",
    targetId:   result.documentId,
    metadata:   { caseId, originalFilename, mimeType, fileSize, via: "specialist_portal" },
  });

  void notifyInternalStaff({
    caseId,
    title:    "社労士より書類がアップロードされました",
    body:     originalFilename,
    linkUrl:  `/cases/${caseId}/documents`,
    category: "info",
  });

  return NextResponse.json({ document: { id: result.documentId } }, { status: 201 });
}
