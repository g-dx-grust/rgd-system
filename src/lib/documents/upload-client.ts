/**
 * 書類アップロード共通クライアントヘルパー
 *
 * 署名付きURL方式の3ステップ（URL取得 → Storage直接PUT → メタデータ登録）を
 * 1ファイル単位で実行する。単体アップローダー / 一括アップローダーの双方から利用する。
 */

import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/types/documents";

export interface UploadFileParams {
  caseId:                 string;
  organizationId:         string;
  documentTypeId:         string;
  participantId?:         string;
  documentRequirementId?: string;
  replacedDocumentId?:    string;
  /** 外部提出画面で使用するアップロードトークン（未認証） */
  uploadToken?:           string;
}

/** クライアント側バリデーション。問題があればエラーメッセージを返す（なければ null）。 */
export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "ファイルサイズが100MBを超えています";
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return "許可されていないファイル形式です";
  }
  return null;
}

/**
 * 1ファイルをアップロードして documents レコードを作成する。
 * 成功時は作成された documentId を返す。失敗時は Error を throw する。
 */
export async function uploadDocumentFile(
  file: File,
  params: UploadFileParams,
  onProgress?: (message: string) => void
): Promise<{ documentId: string }> {
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);

  const {
    caseId,
    organizationId,
    documentTypeId,
    participantId,
    documentRequirementId,
    replacedDocumentId,
    uploadToken,
  } = params;

  // Step 1: 署名付きURLを取得
  onProgress?.("アップロードURLを取得中…");
  const urlRes = await fetch("/api/documents/upload-url", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      caseId,
      organizationId,
      documentTypeId,
      participantId,
      documentRequirementId,
      originalFilename: file.name,
      mimeType:         file.type,
      fileSize:         file.size,
      ...(uploadToken ? { uploadToken } : {}),
    }),
  });

  if (!urlRes.ok) {
    const { error } = (await urlRes.json()) as { error: string };
    throw new Error(error);
  }

  const { uploadUrl, storagePath } = (await urlRes.json()) as {
    uploadUrl:   string;
    storagePath: string;
    token:       string;
  };

  // Step 2: Storage に直接アップロード
  onProgress?.("ファイルをアップロード中…");
  const uploadRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: { "Content-Type": file.type },
    body:    file,
  });

  if (!uploadRes.ok) {
    throw new Error("ストレージへのアップロードに失敗しました");
  }

  // Step 3: メタデータ登録
  onProgress?.("書類情報を登録中…");
  const confirmRes = await fetch("/api/documents/confirm", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      storagePath,
      originalFilename: file.name,
      mimeType:         file.type,
      fileSize:         file.size,
      caseId,
      organizationId,
      documentTypeId,
      participantId,
      documentRequirementId,
      replacedDocumentId,
      ...(uploadToken ? { uploadToken } : {}),
    }),
  });

  if (!confirmRes.ok) {
    const { error } = (await confirmRes.json()) as { error: string };
    throw new Error(error);
  }

  const { document } = (await confirmRes.json()) as { document: { id: string } };
  return { documentId: document.id };
}
