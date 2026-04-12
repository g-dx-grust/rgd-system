import { type HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
}

/** スピナーではなくスケルトンスクリーンを優先する */
export function Skeleton({
  width,
  height = "1rem",
  className = "",
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={["skeleton-shimmer rounded-[var(--radius-sm)]", className].join(" ")}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}

/** テーブル行スケルトン */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height="0.875rem" />
        </td>
      ))}
    </tr>
  );
}

/** カードスケルトン */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-4 space-y-3 border border-[var(--color-border)] rounded-[var(--radius-sm)]">
      <Skeleton height="1rem" width="60%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="0.875rem" />
      ))}
    </div>
  );
}
