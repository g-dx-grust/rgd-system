"use client";

/**
 * DocumentUploader
 *
 * 署名付きURLを使った直接アップロードコンポーネント。
 * ドラッグ&ドロップ / クリック選択に対応。
 * アップロード完了後に /api/documents/confirm を呼ぶ。
 */

import { useCallback, useRef, useState } from "react";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/types/documents";
import type { DocumentType } from "@/types/documents";

interface Props {
  caseId:                string;
  organizationId:        string;
  documentType:          DocumentType;
  participantId?:        string;
  documentRequirementId?: string;
  replacedDocumentId?:   string;
  onSuccess:             (documentId: string) => void;
  onError?:              (message: string) => void;
  /** 外部提出画面で使用するアップロードトークン（未認証） */
  uploadToken?:          string;
}

const ALLOWED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".txt", ".csv", ".xlsx", ".zip",
].join(",");

export function DocumentUploader({
  caseId,
  organizationId,
  documentType,
  participantId,
  documentRequirementId,
  replacedDocumentId,
  onSuccess,
  onError,
  uploadToken,
}: Props) {
  const [isDragging, setIsDragging]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [progress, setProgress]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // クライアント側バリデーション
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onError?.("ファイルサイズが100MBを超えています");
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      onError?.("許可されていないファイル形式です");
      return;
    }

    setUploading(true);
    setProgress("アップロードURLを取得中…");

    try {
      // Step 1: 署名付きURLを取得
      const urlRes = await fetch("/api/documents/upload-url", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          caseId,
          organizationId,
          documentTypeId:        documentType.id,
          participantId,
          documentRequirementId,
          originalFilename:      file.name,
          mimeType:              file.type,
          fileSize:              file.size,
        }),
      });

      if (!urlRes.ok) {
        const { error } = await urlRes.json() as { error: string };
        throw new Error(error);
      }

      const { uploadUrl, storagePath } = await urlRes.json() as {
        uploadUrl:   string;
        storagePath: string;
        token:       string;
      };

      // Step 2: Storage に直接アップロード
      setProgress("ファイルをアップロード中…");
      const uploadRes = await fetch(uploadUrl, {
        method:  "PUT",
        headers: { "Content-Type": file.type },
        body:    file,
      });

      if (!uploadRes.ok) {
        throw new Error("ストレージへのアップロードに失敗しました");
      }

      // Step 3: メタデータ登録
      setProgress("書類情報を登録中…");
      const confirmRes = await fetch("/api/documents/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          storagePath,
          originalFilename:      file.name,
          mimeType:              file.type,
          fileSize:              file.size,
          caseId,
          organizationId,
          documentTypeId:        documentType.id,
          participantId,
          documentRequirementId,
          replacedDocumentId,
          ...(uploadToken ? { uploadToken } : {}),
        }),
      });

      if (!confirmRes.ok) {
        const { error } = await confirmRes.json() as { error: string };
        throw new Error(error);
      }

      const { document } = await confirmRes.json() as { document: { id: string } };
      setProgress(null);
      onSuccess(document.id);
    } catch (err) {
      setProgress(null);
      onError?.(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  }, [caseId, organizationId, documentType, participantId, documentRequirementId, replacedDocumentId, onSuccess, onError, uploadToken]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

  return (
    <div>
      <div
        className={[
          "border-2 border-dashed rounded-[var(--radius-md)] p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)]"
            : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
        ].join(" ")}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="ファイルをドロップまたはクリックして選択"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <span
              className="inline-block w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--color-text-muted)]">{progress}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--color-text)]">
              <span className="font-medium text-[var(--color-accent)]">クリック</span>
              またはドラッグ&ドロップでファイルを選択
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              PDF / 画像 / テキスト / CSV / XLSX / ZIP（最大100MB）
            </p>
          </>
        )}
      </div>
    </div>
  );
}
