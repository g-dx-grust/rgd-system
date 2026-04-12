"use client";

/**
 * ReturnModal
 *
 * 書類差戻しモーダル。
 * 差戻し理由の選択と詳細テキストの入力。
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { RETURN_REASON, RETURN_REASON_LABEL, type ReturnReason } from "@/types/documents";
import { returnDocumentAction } from "@/server/usecases/documents/actions";

interface Props {
  documentId: string;
  caseId:     string;
  filename:   string;
  onClose:    () => void;
  onSuccess:  () => void;
}

export function ReturnModal({ documentId, caseId, filename, onClose, onSuccess }: Props) {
  const [reason, setReason]     = useState<ReturnReason | "">("");
  const [detail, setDetail]     = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!reason) {
      setErrorMsg("差戻し理由を選択してください");
      return;
    }
    setErrorMsg(null);
    startTransition(async () => {
      const result = await returnDocumentAction(
        documentId,
        reason as ReturnReason,
        detail.trim() || undefined,
        caseId
      );
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        onSuccess();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="書類を差戻す"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-white rounded-[var(--radius-md)] shadow-lg w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">書類を差戻す</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-4 truncate">{filename}</p>

        <div className="space-y-4">
          {/* 差戻し理由 */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text)] mb-1.5">
              差戻し理由 <span className="text-[#DC2626]">*</span>
            </label>
            <div className="space-y-1.5">
              {Object.entries(RETURN_REASON).map(([, value]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="returnReason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value as ReturnReason)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                    {RETURN_REASON_LABEL[value as ReturnReason]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 詳細（顧客向け表示文） */}
          <div>
            <label
              htmlFor="return-detail"
              className="block text-xs font-medium text-[var(--color-text)] mb-1.5"
            >
              詳細コメント
              <span className="ml-1 text-xs text-[var(--color-text-muted)] font-normal">
                （顧客向けに表示されます）
              </span>
            </label>
            <textarea
              id="return-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="例：書類の一部が切れて読み取れません。全ページが写っているものを再提出してください。"
              className={[
                "w-full px-3 py-2 text-sm rounded-[var(--radius-sm)]",
                "border border-[var(--color-border)] focus:border-[var(--color-accent)]",
                "outline-none resize-none",
                "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
              ].join(" ")}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)] text-right">
              {detail.length}/500
            </p>
          </div>

          {errorMsg && (
            <p className="text-xs text-[#DC2626]">{errorMsg}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
            キャンセル
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleSubmit}
            loading={isPending}
          >
            差戻す
          </Button>
        </div>
      </div>
    </div>
  );
}
