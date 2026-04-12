/**
 * 申請パッケージ 共有履歴コンポーネント
 *
 * 作成済みパッケージの一覧と共有状況を表示する Server Component。
 */

import type { ApplicationPackage } from "@/types/application-packages";

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

interface Props {
  packages: ApplicationPackage[];
  caseId:   string;
}

export function ApplicationPackageHistory({ packages, caseId }: Props) {
  if (packages.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
        申請パッケージがまだありません。
      </p>
    );
  }

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {packages.map((pkg) => (
        <div key={pkg.id} className="py-4 flex items-start justify-between gap-4">
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

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/api/cases/${caseId}/packages/${pkg.id}/download`}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              ファイル一覧
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDatetime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      timeZone:    "Asia/Tokyo",
      year:        "numeric",
      month:       "2-digit",
      day:         "2-digit",
      hour:        "2-digit",
      minute:      "2-digit",
    });
  } catch {
    return iso;
  }
}
