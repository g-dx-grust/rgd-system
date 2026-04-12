interface Props {
  message: string | null;
}

/**
 * Next Best Action バナー
 *
 * 案件詳細の上部に次に取るべきアクションを1件表示する。
 * message が null の場合は非表示。
 */
export function NextBestAction({ message }: Props) {
  if (!message) return null;

  const isOverdue  = message.startsWith("【期限超過】");
  const isToday    = message.startsWith("【本日期限】");
  const label      = message.replace(/^【[^】]+】/, "");
  const prefix     = isOverdue ? "期限超過" : isToday ? "本日期限" : "次のアクション";

  const colorClass = isOverdue
    ? "border-[var(--color-error)] bg-red-50 text-[var(--color-error)]"
    : isToday
    ? "border-[var(--color-warning)] bg-yellow-50 text-[var(--color-warning)]"
    : "border-[var(--color-accent)] bg-[var(--color-accent-tint)] text-[var(--color-accent)]";

  return (
    <div
      role="alert"
      className={[
        "flex items-start gap-3 px-4 py-3",
        "rounded-[var(--radius-md)] border",
        colorClass,
      ].join(" ")}
    >
      <span className="flex-shrink-0 mt-0.5">
        <AlertIcon />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {prefix}
        </p>
        <p className="text-sm font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}
