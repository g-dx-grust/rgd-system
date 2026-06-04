/**
 * POST /api/specialist/cases/[id]/documents/upload-url
 *
 * 社労士が担当案件へ書類をアップロードするための署名付きURLを発行する。
 * - external_specialist ロール かつ specialist_cases の担当（is_active）であることを確認。
 * - 署名付きアップロードURLは admin クライアントで発行する。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  getSpecialistCaseOrganizationId,
} from "@/server/repositories/specialist";
import { createUploadSignedUrl } from "@/server/repositories/documents";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
} from "@/types/documents";

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

const schema = z.object({
  documentTypeId:   z.string().uuid(),
  originalFilename: z.string().min(1).max(255),
  mimeType:         z.string().min(1),
  fileSize:         z.number().int().positive(),
});

const EXT_MIME_MAP: Record<string, string[]> = {
  pdf:  ["application/pdf"],
  jpg:  ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png:  ["image/png"],
  webp: ["image/webp"],
  txt:  ["text/plain"],
  csv:  ["text/csv"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip:  ["application/zip"],
};

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
  const { documentTypeId, originalFilename, mimeType, fileSize } = parsed.data;

  if (!ALLOWED_MIME_SET.has(mimeType)) {
    return NextResponse.json({ error: "許可されていないファイル形式です" }, { status: 422 });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "ファイルサイズが上限（100MB）を超えています" }, { status: 422 });
  }

  const ext = originalFilename.split(".").pop()?.toLowerCase();
  if (ext && EXT_MIME_MAP[ext] && !EXT_MIME_MAP[ext].includes(mimeType)) {
    return NextResponse.json({ error: "拡張子とファイル形式が一致しません" }, { status: 422 });
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const safeName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `cases/${caseId}/specialist/${documentTypeId}/${yyyy}/${mm}/${uuid}_${safeName}`;

  try {
    const { signedUrl, token } = await createUploadSignedUrl(storagePath);
    return NextResponse.json({
      uploadUrl:   signedUrl,
      storagePath,
      token,
      bucket:      STORAGE_BUCKET,
    });
  } catch (err) {
    console.error("[specialist/documents/upload-url] error:", err);
    return NextResponse.json(
      { error: "アップロードURLの発行に失敗しました" },
      { status: 500 }
    );
  }
}
