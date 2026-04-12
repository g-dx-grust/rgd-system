/**
 * 初回申請 可否チェック表示コンポーネント
 *
 * 必須書類の充足状況を表示し、初回申請への遷移可否を提示する。
 * Server Component。
 */

import type { PreApplicationReadinessResult } from "@/types/application-packages";

interface Props {
  result: PreApplicationReadinessResult;
}

export function PreApplicationReadinessCheck({ result }: Props) {
  const { ready, insufficientRequired, returnedCount, missingItems } = result;

  if (ready) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[#16A34A] bg-[rgba(22,163,74,0.06)] px-4 py-3">
        <span className="mt-0.5 text-[#16A34A]" aria-hidden="true">✓</span>
        <div>
          <p className="text-sm font-medium text-[#16A34A]">申請準備完了</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            必須書類がすべて揃っています。初回申請パッケージを作成できます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-start gap-3 bg-[rgba(202,138,4,0.06)] border-b border-[var(--color-border)] px-4 py-3">
        <span className="mt-0.5 text-[#CA8A04]" aria-hidden="true">!</span>
        <div>
          <p className="text-sm font-medium text-[#CA8A04]">申請準備未完了</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {insufficientRequired > 0 && `必須書類 ${insufficientRequired}件 が未提出。`}
            {returnedCount > 0 && `差戻し中 ${returnedCount}件 があります。`}
            解消してから申請パッケージを作成してください。
          </p>
        </div>
      </div>

      {missingItems.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)]">
          {missingItems.slice(0, 10).map((item, idx) => (
            <li key={idx} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span
                className={[
                  "w-1.5 h-1.5 rounded-full flex-shrink-0",
                  item.reason === "returned"
                    ? "bg-[var(--color-error)]"
                    : "bg-[#CA8A04]",
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="text-[var(--color-text)]">{item.label}</span>
              <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                {item.reason === "returned" ? "差戻し中" : "未提出"}
              </span>
            </li>
          ))}
          {missingItems.length > 10 && (
            <li className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
              他 {missingItems.length - 10} 件…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
