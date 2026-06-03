"use client";

/**
 * DocumentUploader
 *
 * 署名付きURLを使った直接アップロードコンポーネント。
 * ドラッグ&ドロップ / クリック選択に対応。
 * アップロード完了後に /api/documents/confirm を呼ぶ。
 */

import { useCallback, useRef, useState } from "react";
import { uploadDocumentFile } from "@/lib/documents/upload-client";
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
    setUploading(true);
    setProgress("アップロードURLを取得中…");

    try {
      const { documentId } = await uploadDocumentFile(
        file,
        {
          caseId,
          organizationId,
          documentTypeId: documentType.id,
          participantId,
          documentRequirementId,
          replacedDocumentId,
          uploadToken,
        },
        setProgress
      );
      setProgress(null);
      onSuccess(documentId);
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
