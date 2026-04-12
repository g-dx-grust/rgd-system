/**
 * GET /api/documents/upload-url
 *
 * 署名付きアップロードURLを発行する。
 * Storage への直接アップロード方式。
 * アップロード完了後は /api/documents/confirm を呼ぶこと。
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createUploadSignedUrl, getUploadToken } from "@/server/repositories/documents";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET,
} from "@/types/documents";

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

export async function POST(req: NextRequest) {
  let body: {
    caseId?:                string;
    organizationId?:        string;
    documentTypeId?:        string;
    participantId?:         string;
    documentRequirementId?: string;
    originalFilename?:      string;
    mimeType?:              string;
    fileSize?:              number;
    uploadToken?:           string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const { caseId, organizationId, documentTypeId, originalFilename, mimeType, fileSize, uploadToken } = body;

  // 認証: uploadToken があればトークン認証、なければセッション認証
  if (uploadToken) {
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
  } else {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
  }

  if (!caseId || !organizationId || !documentTypeId || !originalFilename || !mimeType || !fileSize) {
    return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
  }

  // MIME タイプ検証（MIME + 拡張子の両確認）
  if (!ALLOWED_MIME_SET.has(mimeType)) {
    return NextResponse.json(
      { error: "許可されていないファイル形式です" },
      { status: 422 }
    );
  }

  // ファイルサイズ検証
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "ファイルサイズが上限（100MB）を超えています" },
      { status: 422 }
    );
  }

  // 拡張子からもMIMEを検証（ファイル名を信用しない）
  const ext = originalFilename.split(".").pop()?.toLowerCase();
  const extMimeMap: Record<string, string[]> = {
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
  if (ext && extMimeMap[ext] && !extMimeMap[ext].includes(mimeType)) {
    return NextResponse.json(
      { error: "拡張子とファイル形式が一致しません" },
      { status: 422 }
    );
  }

  // ストレージパス生成
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const safeName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  let storagePath: string;
  if (body.participantId) {
    storagePath = `cases/${caseId}/participants/${body.participantId}/${documentTypeId}/${yyyy}/${mm}/${uuid}_${safeName}`;
  } else {
    storagePath = `cases/${caseId}/company/${documentTypeId}/${yyyy}/${mm}/${uuid}_${safeName}`;
  }

  try {
    const { signedUrl, token } = await createUploadSignedUrl(storagePath);
    return NextResponse.json({
      uploadUrl:   signedUrl,
      storagePath,
      token,
      bucket:      STORAGE_BUCKET,
    });
  } catch (err) {
    console.error("[upload-url] error:", err);
    return NextResponse.json(
      { error: "アップロードURLの発行に失敗しました" },
      { status: 500 }
    );
  }
}
