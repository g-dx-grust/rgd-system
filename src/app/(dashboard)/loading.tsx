import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton height="1.75rem" width="10rem" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 py-4 space-y-2"
          >
            <Skeleton height="0.75rem" width="6rem" />
            <Skeleton height="1.75rem" width="3rem" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 py-4 space-y-3"
          >
            <Skeleton height="1rem" width="8rem" />
            <Skeleton height="0.875rem" />
            <Skeleton height="0.875rem" />
            <Skeleton height="0.875rem" />
          </div>
        ))}
      </div>
    </div>
  );
}
