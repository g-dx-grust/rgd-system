"use client";

/**
 * 申請タブ クライアントコンポーネント
 *
 * - 初回申請パッケージ作成フォーム（ファイル選定 + sharedTo）
 * - パッケージ共有（pre_application_shared 遷移）
 * - 労働局受理待ち遷移ボタン
 * - 差戻しフロー（差戻しステータス遷移 / 書類回収中へ戻す）
 */

import { useState, useTransition } from "react";
import { PackageFileSelector } from "@/components/domain/applications/PackageFileSelector";
import type { SelectableDocument } from "@/components/domain/applications/PackageFileSelector";
import type { CreateApplicationPackageItemInput } from "@/types/application-packages";
import type { ApplicationPackage } from "@/types/application-packages";
import {
  createPreApplicationPackageAction,
  shareApplicationPackageAction,
  advanceToLaborOfficeWaitingAction,
  markCaseAsReturnedAction,
  resumeDocCollectingAction,
} from "@/server/usecases/application-packages/actions";

interface Props {
  caseId:        string;
  caseCode:      string;
  currentStatus: string;
  isReady:       boolean;
  canEdit:       boolean;
  canStatusChange: boolean;
  documents:     SelectableDocument[];
  packages:      ApplicationPackage[];
}

export function ApplicationsTabClient({
  caseId,
  currentStatus,
  isReady,
  canEdit,
  canStatusChange,
  documents,
  packages: initialPackages,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [sharedTo, setSharedTo]   = useState("");
  const [note, setNote]           = useState("");
  const [selectedItems, setSelectedItems] = useState<CreateApplicationPackageItemInput[]>([]);
  const [packages]                = useState<ApplicationPackage[]>(initialPackages);
  const [draftPackageId, setDraftPackageId] = useState<string | null>(null);

  function showResult(err?: string, msg?: string) {
    setError(err ?? null);
    setSuccess(msg ?? null);
  }

  // ------------------------------------------------------------
  // パッケージ作成
  // ------------------------------------------------------------
  function handleCreatePackage() {
    if (selectedItems.length === 0) {
      setError("1つ以上のファイルを選択してください。");
      return;
    }
    startTransition(async () => {
      const result = await createPreApplicationPackageAction({
        caseId,
        sharedTo: sharedTo || undefined,
        note:     note     || undefined,
        items:    selectedItems,
      });
      if (result.error) {
        showResult(result.error);
      } else {
        setDraftPackageId(result.packageId ?? null);
        showResult(undefined, "パッケージを作成しました。共有先を確認して「共有済みにする」を実行してください。");
      }
    });
  }

  // ------------------------------------------------------------
  // パッケージ共有（pre_application_shared 遷移）
  // ------------------------------------------------------------
  function handleShare(packageId: string) {
    if (!sharedTo.trim()) {
      setError("共有先を入力してください。");
      return;
    }
    startTransition(async () => {
      const result = await shareApplicationPackageAction({ caseId, packageId, sharedTo });
      if (result.error) {
        showResult(result.error);
      } else {
        showResult(undefined, "連携済みにしました。ステータスが「初回申請連携済み」になりました。");
        setDraftPackageId(null);
      }
    });
  }

  // ------------------------------------------------------------
  // 労働局受理待ち遷移
  // ------------------------------------------------------------
  function handleAdvanceToWaiting() {
    startTransition(async () => {
      const result = await advanceToLaborOfficeWaitingAction(caseId);
      if (result.error) showResult(result.error);
      else showResult(undefined, "「労働局受理待ち」に移行しました。");
    });
  }

  // ------------------------------------------------------------
  // 差戻し
  // ------------------------------------------------------------
  function handleMarkReturned() {
    startTransition(async () => {
      const result = await markCaseAsReturnedAction(caseId);
      if (result.error) showResult(result.error);
      else showResult(undefined, "差戻しステータスに変更しました。");
    });
  }

  function handleResumeDocCollecting() {
    startTransition(async () => {
      const result = await resumeDocCollectingAction(caseId);
      if (result.error) showResult(result.error);
      else showResult(undefined, "書類回収中ステータスに戻しました。");
    });
  }

  const canCreatePackage  = canEdit && isReady;
  const isPreShared       = currentStatus === "pre_application_shared";
  const isLaborWaiting    = currentStatus === "labor_office_waiting";
  const isReturned        = currentStatus === "returned";

  return (
    <div className="space-y-6">
      {/* フィードバック */}
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[#DC2626] bg-[rgba(220,38,38,0.06)] px-4 py-3 text-sm text-[#DC2626]">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[var(--radius-md)] border border-[#16A34A] bg-[rgba(22,163,74,0.06)] px-4 py-3 text-sm text-[#16A34A]">
          {success}
        </div>
      )}

      {/* ===== パッケージ作成フォーム ===== */}
      {canCreatePackage && !isPreShared && !isLaborWaiting && (
        <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              初回申請パッケージ作成
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              社労士に渡すファイルを選択してパッケージを作成します。
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* 共有先 */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                共有先（社労士名・メール等）
              </label>
              <input
                type="text"
                value={sharedTo}
                onChange={(e) => setSharedTo(e.target.value)}
                placeholder="例: 田中太郎 / taro@example.com"
                className="w-full h-9 px-3 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            {/* メモ */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                メモ（任意）
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="連携時のメモ"
                className="w-full h-9 px-3 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            {/* ファイル選択 */}
            <div>
              <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                含めるファイルを選択
              </p>
              <PackageFileSelector
                documents={documents}
                onSelectionChange={setSelectedItems}
              />
            </div>

            {/* アカウント発行シート */}
            <div className="flex items-center justify-between py-2.5 border-t border-[var(--color-border)]">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">アカウント発行シート</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  受講者情報からCSVを出力します
                </p>
              </div>
              <a
                href={`/api/cases/${caseId}/account-sheet`}
                download
                className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] border border-[var(--color-accent)] rounded-[var(--radius-sm)] px-3 py-1.5"
              >
                CSVダウンロード
              </a>
            </div>

            {/* 作成ボタン */}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isPending || selectedItems.length === 0}
                onClick={handleCreatePackage}
                className="h-9 px-5 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-sm)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "処理中…" : "パッケージを作成"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ===== ドラフトパッケージが作成された後の共有ボタン ===== */}
      {draftPackageId && canEdit && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">パッケージ作成済み</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              共有先に送付後、「共有済みにする」を押してください。
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleShare(draftPackageId)}
            className="h-9 px-4 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-sm)] disabled:opacity-50"
          >
            {isPending ? "処理中…" : "共有済みにする"}
          </button>
        </div>
      )}

      {/* ===== 労働局受理待ちへの遷移 ===== */}
      {isPreShared && canStatusChange && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">受理確認後に進める</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              社労士へ連携済みです。労働局への申請が完了したら進めてください。
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleAdvanceToWaiting}
            className="h-9 px-4 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-sm)] disabled:opacity-50"
          >
            {isPending ? "処理中…" : "労働局受理待ちへ"}
          </button>
        </div>
      )}

      {/* ===== 差戻しフロー ===== */}
      {canStatusChange && !isReturned && !isLaborWaiting && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text)]">差戻し対応</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              書類に差戻しが生じた場合、差戻しステータスに変更できます。
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleMarkReturned}
            className="h-9 px-4 text-sm font-medium text-[#DC2626] border border-[#DC2626] hover:bg-[rgba(220,38,38,0.06)] rounded-[var(--radius-sm)] disabled:opacity-50"
          >
            {isPending ? "処理中…" : "差戻しにする"}
          </button>
        </div>
      )}

      {isReturned && canStatusChange && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[#DC2626] bg-[rgba(220,38,38,0.06)] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[#DC2626]">差戻し中</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              書類を修正・再提出後、書類回収フローに戻してください。
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleResumeDocCollecting}
            className="h-9 px-4 text-sm font-medium text-[var(--color-accent)] border border-[var(--color-accent)] hover:bg-[var(--color-accent-tint)] rounded-[var(--radius-sm)] disabled:opacity-50"
          >
            {isPending ? "処理中…" : "書類回収に戻す"}
          </button>
        </div>
      )}

      {/* ===== パッケージ共有履歴 ===== */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h3 className="text-base font-semibold text-[var(--color-text)]">共有履歴</h3>
        </div>
        <div className="px-4">
          {packages.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
              まだ申請パッケージはありません。
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {packages.map((pkg) => (
                <PackageHistoryRow key={pkg.id} pkg={pkg} caseId={caseId} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------
// パッケージ履歴行
// ------------------------------------------------------------

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  pre:   "初回申請",
  final: "最終申請",
};

const PACKAGE_STATUS_LABELS: Record<string, string> = {
  draft:    "作成中",
  shared:   "共有済み",
  archived: "アーカイブ",
};

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  shared:   "bg-[rgba(26,86,219,0.08)] text-[var(--color-accent)]",
  archived: "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
};

function formatDatetime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year:     "numeric",
      month:    "2-digit",
      day:      "2-digit",
      hour:     "2-digit",
      minute:   "2-digit",
    });
  } catch {
    return iso;
  }
}

function PackageHistoryRow({ pkg, caseId }: { pkg: ApplicationPackage; caseId: string }) {
  return (
    <div className="py-4 flex items-start justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-text)]">
            {PACKAGE_TYPE_LABELS[pkg.packageType] ?? pkg.packageType}
          </span>
          <span
            className={[
              "text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)]",
              STATUS_STYLES[pkg.packageStatus] ?? "",
            ].join(" ")}
          >
            {PACKAGE_STATUS_LABELS[pkg.packageStatus] ?? pkg.packageStatus}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          作成日時: {formatDatetime(pkg.generatedAt)}
          {pkg.generatedByName && ` · ${pkg.generatedByName}`}
        </p>
        {pkg.sharedTo && (
          <p className="text-xs text-[var(--color-text-muted)]">
            共有先: {pkg.sharedTo}
            {pkg.sharedAt && ` (${formatDatetime(pkg.sharedAt)})`}
          </p>
        )}
        {pkg.note && (
          <p className="text-xs text-[var(--color-text-sub)]">{pkg.note}</p>
        )}
        {pkg.items.length > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            含むファイル: {pkg.items.length}件
          </p>
        )}
      </div>
      <a
        href={`/api/cases/${caseId}/packages/${pkg.id}/download`}
        className="text-xs text-[var(--color-accent)] hover:underline flex-shrink-0"
      >
        ファイル一覧
      </a>
    </div>
  );
}
