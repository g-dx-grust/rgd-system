"use client";

/**
 * 社労士専用 — 書類アップロードセクション
 *
 * 社労士が担当案件へ書類（計画届・計画受付書 等）を添付する。
 * 書類種別を選び、複数ファイルをまとめてアップロードできる。
 * 各ファイルは書類要件として登録され、社内の書類タブにも表示される。
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateUploadFile } from "@/lib/documents/upload-client";
import type { DocumentType } from "@/types/documents";

interface Props {
  caseId:        string;
  documentTypes: DocumentType[];
}

const ALLOWED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".txt", ".csv", ".xlsx", ".zip",
].join(",");

async function uploadOneFile(
  caseId: string,
  documentTypeId: string,
  file: File
): Promise<void> {
  // Step 1: 署名付きURL取得
  const urlRes = await fetch(`/api/specialist/cases/${caseId}/documents/upload-url`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      documentTypeId,
      originalFilename: file.name,
      mimeType:         file.type,
      fileSize:         file.size,
    }),
  });
  if (!urlRes.ok) {
    const { error } = (await urlRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(error ?? "アップロードURLの取得に失敗しました");
  }
  const { uploadUrl, storagePath } = (await urlRes.json()) as {
    uploadUrl: string;
    storagePath: string;
  };

  // Step 2: Storage へ直接アップロード
  const putRes = await fetch(uploadUrl, {
    method:  "PUT",
    headers: { "Content-Type": file.type },
    body:    file,
  });
  if (!putRes.ok) throw new Error("ストレージへのアップロードに失敗しました");

  // Step 3: メタデータ登録
  const confirmRes = await fetch(`/api/specialist/cases/${caseId}/documents/confirm`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      storagePath,
      documentTypeId,
      originalFilename: file.name,
      mimeType:         file.type,
      fileSize:         file.size,
    }),
  });
  if (!confirmRes.ok) {
    const { error } = (await confirmRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(error ?? "書類の登録に失敗しました");
  }
}

export function SpecialistUploadSection({ caseId, documentTypes }: Props) {
  const router = useRouter();
  const [typeId, setTypeId]       = useState("");
  const [files, setFiles]         = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setDone(null);
    const picked = Array.from(e.target.files ?? []);
    const invalid = picked.find((f) => validateUploadFile(f) !== null);
    if (invalid) {
      setError(`「${invalid.name}」: ${validateUploadFile(invalid)}`);
      return;
    }
    setFiles(picked);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!typeId) {
      setError("書類種別を選択してください");
      return;
    }
    if (files.length === 0) {
      setError("ファイルを選択してください");
      return;
    }
    setError(null);
    setDone(null);
    setUploading(true);

    const failures: string[] = [];
    let count = 0;
    for (const file of files) {
      setProgress(`アップロード中… (${count + 1}/${files.length}) ${file.name}`);
      try {
        await uploadOneFile(caseId, typeId, file);
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "失敗"}`);
      }
      count += 1;
    }

    setUploading(false);
    setProgress(null);

    if (failures.length > 0) {
      setError(`${files.length - failures.length}/${files.length} 件成功。失敗: ${failures.join(" / ")}`);
    } else {
      setDone(`${files.length} 件のファイルをアップロードしました。`);
    }
    setFiles([]);
    setTypeId("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }, [typeId, files, caseId, router]);

  return (
    <section className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">
        書類をアップロード
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        計画届・計画受付書などを添付できます。アップロードした書類は運営会社（社内）にも共有されます。
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="sp-doc-type" className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            書類種別 <span className="text-[#DC2626]">*</span>
          </label>
          <select
            id="sp-doc-type"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            disabled={uploading}
            className="h-9 px-3 text-sm border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-bg-secondary)] min-w-64"
          >
            <option value="">選択してください</option>
            {documentTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>{dt.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sp-doc-files" className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            ファイル（複数選択可） <span className="text-[#DC2626]">*</span>
          </label>
          <input
            id="sp-doc-files"
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS}
            onChange={handleSelect}
            disabled={uploading}
            className="block w-full text-sm text-[var(--color-text)] file:mr-3 file:rounded-[var(--radius-sm)] file:border file:border-[var(--color-border-strong)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-[var(--color-text)]"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            PDF / 画像（JPG・PNG・WebP）/ テキスト / CSV / XLSX / ZIP（最大100MB）
          </p>
        </div>

        {progress && <p className="text-xs text-[var(--color-accent)]">{progress}</p>}
        {error && (
          <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-[var(--radius-sm)] px-3 py-2" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="text-xs text-[#16A34A] bg-green-50 border border-green-200 rounded-[var(--radius-sm)] px-3 py-2" role="status">
            {done}
          </p>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="h-9 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? "アップロード中..." : files.length > 0 ? `${files.length}件をアップロード` : "アップロード"}
        </button>
      </div>
    </section>
  );
}
