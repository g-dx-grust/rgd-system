import { getCurrentUserProfile } from "@/lib/auth/session";
import { listNotifications } from "@/server/repositories/notifications";
import { Card } from "@/components/ui";
import { NotificationList } from "@/components/domain/notifications/NotificationList";

export const metadata = { title: "通知センター | RGDシステム" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [user, sp] = await Promise.all([
    getCurrentUserProfile(),
    searchParams,
  ]);

  if (!user) return null;

  const unreadOnly = sp["filter"] === "unread";
  const page       = Number(sp["page"] ?? 1);

  const result = await listNotifications({
    userId: user.id,
    unreadOnly,
    page,
    perPage: 30,
  });

  const totalPages = Math.ceil(result.total / 30);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
          通知センター
        </h1>
        {result.unreadCount > 0 && (
          <span className="text-sm text-[var(--color-text-muted)]">
            未読 <span className="text-[var(--color-accent)] font-semibold">{result.unreadCount}</span> 件
          </span>
        )}
      </div>

      {/* フィルタタブ */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        <FilterTab label="すべて"  href="/notifications"               active={!unreadOnly} />
        <FilterTab label="未読のみ" href="/notifications?filter=unread" active={unreadOnly}  />
      </div>

      <Card>
        <NotificationList
          notifications={result.notifications}
          totalPages={totalPages}
          currentPage={page}
          unreadOnly={unreadOnly}
        />
      </Card>
    </div>
  );
}

function FilterTab({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={[
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
          : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      ].join(" ")}
    >
      {label}
    </a>
  );
}
