"use client";

/**
 * DocumentRequirementRow
 *
 * 書類要件1行のインタラクティブ部分。
 * - 1要件に複数ファイルを添付できる（各ファイルごとに確認 / 差替え / 削除 / 分割）。
 * - 承認 / 差戻しは「要件（項目）単位」でまとめて行う。
 * - 「＋ ファイルを追加」で複数ファイルをまとめて追加できる。
 */

import { useCallback, useState, useTransition } from "react";
import { DocumentUploader } from "./DocumentUploader";
import { DocumentPreview } from "./DocumentPreview";
import { ReturnModal } from "./ReturnModal";
import { SplitPdfModal } from "./SplitPdfModal";
import { FileDropzone } from "./FileDropzone";
import { RequirementStatusBadge } from "./ReviewStatusBadge";
import { Button } from "@/components/ui/Button";
import { AsyncActionButton } from "@/components/ui";
import {
  approveRequirementAction,
  deleteDocumentAction,
  deleteRequirementAction,
} from "@/server/usecases/documents/actions";
import { uploadDocumentFile, validateUploadFile } from "@/lib/documents/upload-client";
import type { Document, DocumentRequirement, DocumentType } from "@/types/documents";

interface Props {
  requirement:     DocumentRequirement;
  caseId:          string;
  organizationId:  string;
  canDelete:       boolean;
  canEdit:         boolean;
  documentTypes:   DocumentType[];
  onRefresh:       () => void;
}

// ----------------------------------------------------------------
// 複数ファイルをまとめて追加するアップローダー（差替えではなく「追加」）
// ----------------------------------------------------------------
function AddFilesUploader({
  caseId,
  organizationId,
  requirement,
  onDone,
  onError,
}: {
  caseId:         string;
  organizationId: string;
  requirement:    DocumentRequirement;
  onDone:         () => void;
  onError:        (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState<string | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const invalid = files.find((f) => validateUploadFile(f) !== null);
    if (invalid) {
      onError(`「${invalid.name}」: ${validateUploadFile(invalid)}`);
      return;
    }

    setUploading(true);
    const failures: string[] = [];
    let count = 0;
    for (const file of files) {
      setProgress(`アップロード中… (${count + 1}/${files.length}) ${file.name}`);
      try {
        await uploadDocumentFile(file, {
          caseId,
          organizationId,
          documentTypeId:        requirement.documentTypeId,
          participantId:         requirement.participantId ?? undefined,
          documentRequirementId: requirement.id,
          // replacedDocumentId は渡さない → 既存ファイルを置き換えず「追加」する
        });
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "失敗"}`);
      }
      count += 1;
    }
    setUploading(false);
    setProgress(null);
    if (failures.length > 0) onError(failures.join(" / "));
    onDone();
  }, [caseId, organizationId, requirement, onDone, onError]);

  return (
    <div className="mt-2">
      <FileDropzone
        onFiles={handleFiles}
        disabled={uploading}
        compact
        hint="複数ファイルを選択できます。選んだファイルはこの項目にまとめて追加されます（最大100MB）"
      />
      {progress && (
        <p className="mt-1 text-xs text-[var(--color-accent)]">{progress}</p>
      )}
    </div>
  );
}

export function DocumentRequirementRow({
  requirement,
  caseId,
  organizationId,
  canDelete,
  canEdit,
  documentTypes,
  onRefresh,
}: Props) {
  const [previewDoc, setPreviewDoc]   = useState<Document | null>(null);
  const [splitDoc, setSplitDoc]       = useState<Document | null>(null);
  const [replaceDoc, setReplaceDoc]   = useState<Document | null>(null);
  const [adding, setAdding]           = useState(false);
  const [showReturn, setShowReturn]   = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  const { documents, documentType, status, dueDate, requiredFlag, latestDocument } = requirement;
  const hasFiles = documents.length > 0;

  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "approved";

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveRequirementAction(requirement.id, caseId);
      if (result.error) setErrorMsg(result.error);
      else onRefresh();
    });
  };

  return (
    <div className="py-3 border-b border-[var(--color-border)] last:border-b-0">
      {/* 見出し行 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--color-text)]">
              {documentType.name}
            </span>
            {requiredFlag && (
              <span className="text-xs text-[#DC2626] font-medium">必須</span>
            )}
            <RequirementStatusBadge status={status} />
            {hasFiles && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {documents.length}ファイル
              </span>
            )}
          </div>

          {dueDate && (
            <p className={`mt-0.5 text-xs ${isOverdue ? "text-[#DC2626] font-medium" : "text-[var(--color-text-muted)]"}`}>
              期限: {new Date(dueDate).toLocaleDateString("ja-JP")}
              {isOverdue && " — 期限超過"}
            </p>
          )}

          {latestDocument?.returnReasonDetail && (
            <p className="mt-1 text-xs text-[#DC2626] bg-[rgba(220,38,38,0.06)] px-2 py-1 rounded-[var(--radius-sm)]">
              差戻しコメント: {latestDocument.returnReasonDetail}
            </p>
          )}

          {errorMsg && (
            <p className="mt-1 text-xs text-[#DC2626]">{errorMsg}</p>
          )}
        </div>

        {/* 要件単位のアクション */}
        <div className="flex items-center gap-2 shrink-0">
          {hasFiles && status !== "approved" && (
            <>
              <Button variant="primary" size="sm" onClick={handleApprove} loading={isPending}>
                承認
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowReturn(true)}
                disabled={isPending}
              >
                差戻し
              </Button>
            </>
          )}
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setAdding((v) => !v); setErrorMsg(null); }}
            >
              {adding ? "閉じる" : hasFiles ? "+ ファイルを追加" : "提出"}
            </Button>
          )}
          {canDelete && (
            <AsyncActionButton
              label="項目削除"
              pendingLabel="削除中..."
              confirmMessage={
                hasFiles
                  ? `項目「${documentType.name}」を削除しますか？\n添付されている${documents.length}件のファイルもまとめて削除されます。`
                  : `項目「${documentType.name}」を削除しますか？`
              }
              action={() => deleteRequirementAction(requirement.id, caseId)}
              refreshOnSuccess={false}
              onSuccess={onRefresh}
            />
          )}
        </div>
      </div>

      {/* ファイル一覧 */}
      {hasFiles && (
        <ul className="mt-2 space-y-1">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text)]">
                {doc.originalFilename}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                >
                  確認
                </button>
                {canEdit && (
                  <button
                    onClick={() => setReplaceDoc(doc)}
                    className="text-xs text-[var(--color-text-sub)] hover:underline"
                  >
                    差替え
                  </button>
                )}
                {canEdit && doc.mimeType === "application/pdf" && (
                  <button
                    onClick={() => setSplitDoc(doc)}
                    className="text-xs text-[var(--color-text-sub)] hover:underline"
                  >
                    分割
                  </button>
                )}
                {canDelete && (
                  <AsyncActionButton
                    label="削除"
                    pendingLabel="削除中..."
                    confirmMessage={`ファイル「${doc.originalFilename}」を削除しますか？`}
                    action={() => deleteDocumentAction(doc.id, caseId)}
                    refreshOnSuccess={false}
                    onSuccess={onRefresh}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ファイル追加 */}
      {adding && canEdit && (
        <AddFilesUploader
          caseId={caseId}
          organizationId={organizationId}
          requirement={requirement}
          onDone={() => { setAdding(false); onRefresh(); }}
          onError={(msg) => setErrorMsg(msg)}
        />
      )}

      {/* 差替えアップローダー */}
      {replaceDoc && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-[var(--color-text-muted)]">
            「{replaceDoc.originalFilename}」を差し替えます
          </p>
          <DocumentUploader
            caseId={caseId}
            organizationId={organizationId}
            documentType={documentType}
            participantId={requirement.participantId ?? undefined}
            documentRequirementId={requirement.id}
            replacedDocumentId={replaceDoc.id}
            onSuccess={() => { setReplaceDoc(null); onRefresh(); }}
            onError={(msg) => setErrorMsg(msg)}
          />
          <button
            onClick={() => setReplaceDoc(null)}
            className="mt-1 text-xs text-[var(--color-text-muted)] hover:underline"
          >
            差替えをやめる
          </button>
        </div>
      )}

      {/* プレビュー */}
      {previewDoc && (
        <DocumentPreview
          documentId={previewDoc.id}
          originalFilename={previewDoc.originalFilename}
          mimeType={previewDoc.mimeType}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* 差戻しモーダル（要件単位） */}
      {showReturn && (
        <ReturnModal
          requirementId={requirement.id}
          caseId={caseId}
          filename={documentType.name}
          onClose={() => setShowReturn(false)}
          onSuccess={() => { setShowReturn(false); onRefresh(); }}
        />
      )}

      {/* PDF分割モーダル */}
      {splitDoc && (
        <SplitPdfModal
          documentId={splitDoc.id}
          caseId={caseId}
          originalFilename={splitDoc.originalFilename}
          currentTypeId={documentType.id}
          documentTypes={documentTypes}
          onClose={() => setSplitDoc(null)}
          onSuccess={() => { setSplitDoc(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
