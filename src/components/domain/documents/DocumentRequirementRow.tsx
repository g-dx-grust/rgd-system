"use client";

/**
 * DocumentRequirementRow
 *
 * 書類要件1行のインタラクティブ部分。
 * - アップロード済みの場合: プレビュー / 差戻し / 承認ボタン
 * - 未提出の場合: アップローダーを展開
 * - 版履歴リンク
 */

import { useState, useTransition } from "react";
import { DocumentUploader } from "./DocumentUploader";
import { DocumentPreview } from "./DocumentPreview";
import { ReturnModal } from "./ReturnModal";
import { RequirementStatusBadge, ReviewStatusBadge } from "./ReviewStatusBadge";
import { Button } from "@/components/ui/Button";
import { approveDocumentAction } from "@/server/usecases/documents/actions";
import type { DocumentRequirement } from "@/types/documents";

interface Props {
  requirement:     DocumentRequirement;
  caseId:          string;
  organizationId:  string;
  onRefresh:       () => void;
}

export function DocumentRequirementRow({
  requirement,
  caseId,
  organizationId,
  onRefresh,
}: Props) {
  const [uploading, setUploading]         = useState(false);
  const [previewDocId, setPreviewDocId]   = useState<string | null>(null);
  const [showReturn, setShowReturn]       = useState(false);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [isPending, startTransition]      = useTransition();

  const { latestDocument, documentType, status, dueDate, requiredFlag } = requirement;

  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== "approved";

  const handleApprove = () => {
    if (!latestDocument) return;
    startTransition(async () => {
      const result = await approveDocumentAction(latestDocument.id, caseId);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        onRefresh();
      }
    });
  };

  return (
    <div className="py-3 border-b border-[var(--color-border)] last:border-b-0">
      {/* 書類種別行 */}
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
            {latestDocument && (
              <ReviewStatusBadge status={latestDocument.reviewStatus} />
            )}
          </div>

          {/* 期限 */}
          {dueDate && (
            <p className={`mt-0.5 text-xs ${isOverdue ? "text-[#DC2626] font-medium" : "text-[var(--color-text-muted)]"}`}>
              期限: {new Date(dueDate).toLocaleDateString("ja-JP")}
              {isOverdue && " — 期限超過"}
            </p>
          )}

          {/* 差戻し理由 */}
          {latestDocument?.returnReasonDetail && (
            <p className="mt-1 text-xs text-[#DC2626] bg-[rgba(220,38,38,0.06)] px-2 py-1 rounded-[var(--radius-sm)]">
              差戻しコメント: {latestDocument.returnReasonDetail}
            </p>
          )}

          {errorMsg && (
            <p className="mt-1 text-xs text-[#DC2626]">{errorMsg}</p>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 shrink-0">
          {latestDocument && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewDocId(latestDocument.id)}
              >
                確認
              </Button>
              {latestDocument.reviewStatus !== "approved" && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApprove}
                    loading={isPending}
                  >
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
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setUploading((v) => !v)}
          >
            {uploading ? "閉じる" : latestDocument ? "差替え" : "提出"}
          </Button>
        </div>
      </div>

      {/* アップローダー展開 */}
      {uploading && (
        <div className="mt-3">
          <DocumentUploader
            caseId={caseId}
            organizationId={organizationId}
            documentType={documentType}
            documentRequirementId={requirement.id}
            replacedDocumentId={latestDocument?.id}
            onSuccess={() => {
              setUploading(false);
              onRefresh();
            }}
            onError={(msg) => setErrorMsg(msg)}
          />
        </div>
      )}

      {/* プレビューモーダル */}
      {previewDocId && latestDocument && (
        <DocumentPreview
          documentId={previewDocId}
          originalFilename={latestDocument.originalFilename}
          mimeType={latestDocument.mimeType}
          onClose={() => setPreviewDocId(null)}
        />
      )}

      {/* 差戻しモーダル */}
      {showReturn && latestDocument && (
        <ReturnModal
          documentId={latestDocument.id}
          caseId={caseId}
          filename={latestDocument.originalFilename}
          onClose={() => setShowReturn(false)}
          onSuccess={() => {
            setShowReturn(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
