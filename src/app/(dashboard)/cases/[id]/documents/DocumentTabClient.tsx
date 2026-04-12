"use client";

/**
 * DocumentTabClient
 *
 * 書類タブの状態管理・要件追加フォームなど
 * インタラクティブ部分をまとめたクライアントコンポーネント。
 *
 * 受講者個別タブは廃止。全書類を案件単位で管理する。
 */

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DocumentRequirementRow } from "@/components/domain/documents/DocumentRequirementRow";
import { addRequirementAction, issueUploadTokenAction } from "@/server/usecases/documents/actions";
import type {
  DocumentRequirement,
  DocumentType,
} from "@/types/documents";
import type { RoleCode } from "@/lib/rbac";

interface Props {
  caseId:         string;
  organizationId: string;
  requirements:   DocumentRequirement[];
  documentTypes:  DocumentType[];
  userRoleCode:   RoleCode;
}

export function DocumentTabClient({
  caseId,
  organizationId,
  requirements,
  documentTypes,
  userRoleCode,
}: Props) {
  const router = useRouter();
  const [showAddRequirement, setShowAddRequirement] = useState(false);
  const [selectedTypeId, setSelectedTypeId]         = useState("");
  const [dueDate, setDueDate]                       = useState("");
  const [addError, setAddError]                     = useState<string | null>(null);
  const [showTokenDialog, setShowTokenDialog]       = useState(false);
  const [uploadLink, setUploadLink]                 = useState<string | null>(null);
  const [isPending, startTransition]                = useTransition();

  const canEdit = ["admin", "operations_manager", "operations_staff"].includes(userRoleCode);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleAddRequirement = () => {
    if (!selectedTypeId) {
      setAddError("書類種別を選択してください");
      return;
    }
    setAddError(null);
    startTransition(async () => {
      const result = await addRequirementAction({
        caseId,
        documentTypeId: selectedTypeId,
        requiredFlag:   true,
        dueDate:        dueDate || undefined,
      });
      if (result.error) {
        setAddError(result.error);
      } else {
        setSelectedTypeId("");
        setDueDate("");
        setShowAddRequirement(false);
        refresh();
      }
    });
  };

  const handleIssueToken = () => {
    startTransition(async () => {
      const result = await issueUploadTokenAction({ caseId, organizationId });
      if (result.error) {
        alert(result.error);
      } else if (result.token) {
        const link = `${window.location.origin}/upload/${result.token}`;
        setUploadLink(link);
        setShowTokenDialog(true);
      }
    });
  };

  return (
    <div>
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)]">
        {/* ツールバー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-sm font-medium text-[var(--color-text)]">
            書類一覧
            <span className="ml-2 text-xs text-[var(--color-text-muted)] font-normal">
              {requirements.length}件
            </span>
          </span>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleIssueToken}
                loading={isPending}
              >
                提出リンク発行
              </Button>
            )}
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddRequirement((v) => !v)}
              >
                {showAddRequirement ? "キャンセル" : "+ 書類要件を追加"}
              </Button>
            )}
          </div>
        </div>

        {/* 書類要件追加フォーム */}
        {showAddRequirement && canEdit && (
          <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-48">
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                  書類種別
                </label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
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
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">
                  提出期限
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={[
                    "px-2 py-1.5 text-sm rounded-[var(--radius-sm)]",
                    "border border-[var(--color-border)] focus:border-[var(--color-accent)]",
                    "outline-none text-[var(--color-text)]",
                  ].join(" ")}
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddRequirement}
                loading={isPending}
              >
                追加
              </Button>
            </div>
            {addError && (
              <p className="mt-2 text-xs text-[#DC2626]">{addError}</p>
            )}
          </div>
        )}

        {/* 要件リスト */}
        <div className="px-4 divide-y divide-[var(--color-border)]">
          {requirements.length === 0 ? (
            <p className="py-8 text-sm text-center text-[var(--color-text-muted)]">
              書類要件が登録されていません
            </p>
          ) : (
            requirements.map((req) => (
              <DocumentRequirementRow
                key={req.id}
                requirement={req}
                caseId={caseId}
                organizationId={organizationId}
                onRefresh={refresh}
              />
            ))
          )}
        </div>
      </div>

      {/* 提出リンクダイアログ */}
      {showTokenDialog && uploadLink && (
        <UploadLinkDialog
          link={uploadLink}
          onClose={() => { setShowTokenDialog(false); setUploadLink(null); }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// 提出リンクダイアログ
// ----------------------------------------------------------------
function UploadLinkDialog({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 bg-white rounded-[var(--radius-md)] shadow-lg w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">
          顧客向け提出リンク
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          このリンクを顧客担当者に共有してください。有効期間は7日間です。
        </p>
        <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2">
          <span className="text-xs text-[var(--color-text)] flex-1 truncate select-all">
            {link}
          </span>
          <button
            onClick={handleCopy}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline shrink-0"
          >
            {copied ? "コピー済み" : "コピー"}
          </button>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
