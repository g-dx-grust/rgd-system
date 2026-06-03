"use client";

/**
 * BulkUploadPanel
 *
 * 書類種別を選択して複数ファイルをまとめてアップロードする。
 * ファイル1つにつき書類要件を1件作成し、それぞれを独立した書類として登録する
 * （版として潰れず、全ファイルが一覧に並ぶ）。
 *
 * 主用途: 雇用契約書など、同種の書類を複数枚まとめて追加したいケース。
 */

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadDocumentFile, validateUploadFile } from "@/lib/documents/upload-client";
import { createRequirementReturningIdAction } from "@/server/usecases/documents/actions";
import type { DocumentType } from "@/types/documents";

interface Props {
  caseId:         string;
  organizationId: string;
  documentTypes:  DocumentType[];
  onSuccess:      () => void;
  onCancel:       () => void;
}

const ALLOWED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".txt", ".csv", ".xlsx", ".zip",
].join(",");

export function BulkUploadPanel({
  caseId,
  organizationId,
  documentTypes,
  onSuccess,
  onCancel,
}: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [files, setFiles]                   = useState<File[]>([]);
  const [uploading, setUploading]           = useState(false);
  const [progress, setProgress]             = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const picked = Array.from(e.target.files ?? []);
    // クライアント側バリデーション（不正なファイルは弾く）
    const invalid = picked.find((f) => validateUploadFile(f) !== null);
    if (invalid) {
      setError(`「${invalid.name}」: ${validateUploadFile(invalid)}`);
      return;
    }
    setFiles(picked);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedTypeId) {
      setError("書類種別を選択してください");
      return;
    }
    if (files.length === 0) {
      setError("ファイルを選択してください");
      return;
    }

    setError(null);
    setUploading(true);

    const failures: string[] = [];
    let done = 0;

    for (const file of files) {
      setProgress(`アップロード中… (${done + 1}/${files.length}) ${file.name}`);
      try {
        // ファイルごとに要件を1件作成し、その要件に紐づけて登録する
        const reqResult = await createRequirementReturningIdAction({
          caseId,
          documentTypeId: selectedTypeId,
          requiredFlag:   false,
        });
        if (reqResult.error || !reqResult.requirementId) {
          throw new Error(reqResult.error ?? "書類要件の作成に失敗しました");
        }

        await uploadDocumentFile(file, {
          caseId,
          organizationId,
          documentTypeId:        selectedTypeId,
          documentRequirementId: reqResult.requirementId,
        });
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "失敗"}`);
      }
      done += 1;
    }

    setUploading(false);
    setProgress(null);

    if (failures.length > 0) {
      setError(
        `${files.length - failures.length}/${files.length} 件成功。失敗: ${failures.join(" / ")}`
      );
      // 一部成功している可能性があるため一覧は更新する
      onSuccess();
      return;
    }

    // 全件成功
    setFiles([]);
    setSelectedTypeId("");
    if (inputRef.current) inputRef.current.value = "";
    onSuccess();
  }, [selectedTypeId, files, caseId, organizationId, onSuccess]);

  return (
    <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-48">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">
            書類種別
          </label>
          <select
            value={selectedTypeId}
            onChange={(e) => setSelectedTypeId(e.target.value)}
            disabled={uploading}
            className={[
              "w-full px-2 py-1.5 text-sm rounded-[var(--radius-sm)]",
              "border border-[var(--color-border)] focus:border-[var(--color-accent)]",
              "outline-none bg-white text-[var(--color-text)]",
            ].join(" ")}
          >
            <option value="">-- 選択 --</option>
            {documentTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-56">
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">
            ファイル（複数選択可）
          </label>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS}
            onChange={handleSelectFiles}
            disabled={uploading}
            className="block w-full text-sm text-[var(--color-text)] file:mr-3 file:rounded-[var(--radius-sm)] file:border file:border-[var(--color-border)] file:bg-white file:px-3 file:py-1 file:text-sm file:text-[var(--color-text)]"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleUpload}
          loading={uploading}
        >
          {files.length > 0 ? `${files.length}件をアップロード` : "アップロード"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={uploading}
        >
          閉じる
        </Button>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        選択したファイルは1枚ずつ独立した書類として保存されます。
      </p>

      {progress && (
        <p className="mt-2 text-xs text-[var(--color-accent)]">{progress}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-[#DC2626]">{error}</p>
      )}
    </div>
  );
}
