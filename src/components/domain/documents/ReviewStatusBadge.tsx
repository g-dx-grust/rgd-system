/**
 * レビューステータスバッジ
 * 書類の review_status / requirement status を色付きバッジで表示する。
 */

import {
  REVIEW_STATUS_LABEL,
  REQUIREMENT_STATUS_LABEL,
  type ReviewStatus,
  type DocumentRequirementStatus,
} from "@/types/documents";

// レビューステータス
interface ReviewBadgeProps {
  status: ReviewStatus;
}

const REVIEW_BADGE_STYLE: Record<ReviewStatus, string> = {
  uploaded:  "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  reviewing: "bg-[rgba(26,86,219,0.08)] text-[var(--color-accent)]",
  returned:  "bg-[rgba(220,38,38,0.08)] text-[#DC2626]",
  approved:  "bg-[rgba(22,163,74,0.08)] text-[#16A34A]",
};

export function ReviewStatusBadge({ status }: ReviewBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-[var(--radius-sm)]",
        REVIEW_BADGE_STYLE[status],
      ].join(" ")}
    >
      {REVIEW_STATUS_LABEL[status]}
    </span>
  );
}

// 要件ステータス
interface RequirementBadgeProps {
  status: DocumentRequirementStatus;
}

const REQ_BADGE_STYLE: Record<DocumentRequirementStatus, string> = {
  pending:  "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  received: "bg-[rgba(26,86,219,0.08)] text-[var(--color-accent)]",
  returned: "bg-[rgba(220,38,38,0.08)] text-[#DC2626]",
  approved: "bg-[rgba(22,163,74,0.08)] text-[#16A34A]",
};

export function RequirementStatusBadge({ status }: RequirementBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-[var(--radius-sm)]",
        REQ_BADGE_STYLE[status],
      ].join(" ")}
    >
      {REQUIREMENT_STATUS_LABEL[status]}
    </span>
  );
}
