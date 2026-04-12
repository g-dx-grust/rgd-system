/**
 * 書類充足率バッジ
 * 必須書類の充足率を視覚的に表示する。
 */
import type { CaseDocumentSummary } from "@/types/documents";

interface Props {
  summary: CaseDocumentSummary;
  size?: "sm" | "md";
}

export function CompletionBadge({ summary, size = "md" }: Props) {
  const { completionRate, insufficientCount, returnedCount } = summary;

  let colorClass: string;
  if (completionRate === 100) {
    colorClass = "text-[#16A34A]";
  } else if (insufficientCount > 0 || returnedCount > 0) {
    colorClass = "text-[#DC2626]";
  } else {
    colorClass = "text-[#CA8A04]";
  }

  if (size === "sm") {
    return (
      <span className={`text-xs font-medium ${colorClass}`}>
        {completionRate}%
        {insufficientCount > 0 && (
          <span className="ml-1 text-[#DC2626]">不足{insufficientCount}</span>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* 進捗バー */}
      <div className="flex-1 h-1.5 bg-[var(--color-bg-secondary)] rounded-sm overflow-hidden">
        <div
          className={`h-full transition-all ${
            completionRate === 100 ? "bg-[#16A34A]" : "bg-[var(--color-accent)]"
          }`}
          style={{ width: `${completionRate}%` }}
        />
      </div>
      <span className={`text-sm font-medium tabular-nums ${colorClass}`}>
        {completionRate}%
      </span>
      {insufficientCount > 0 && (
        <span className="text-xs text-[#DC2626]">未提出 {insufficientCount}件</span>
      )}
      {returnedCount > 0 && (
        <span className="text-xs text-[#DC2626]">差戻し {returnedCount}件</span>
      )}
    </div>
  );
}
