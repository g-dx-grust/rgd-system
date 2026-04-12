import Link from "next/link";
import { listAllInvoices, INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/server/repositories/invoices";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const metadata = {
  title: "請求管理 | RGDシステム",
};

export default async function BillingPage() {
  const user = await getCurrentUserProfile();

  if (!can(user?.roleCode, PERMISSIONS.BILLING_REGISTER)) {
    redirect("/dashboard");
  }

  const invoices = await listAllInvoices();

  const totalAmount   = invoices.reduce((acc, i) => acc + (i.amount ?? 0), 0);
  const paidAmount    = invoices.filter((i) => i.billingStatus === "paid").reduce((acc, i) => acc + (i.amount ?? 0), 0);
  const overdueCount  = invoices.filter((i) => i.billingStatus === "overdue").length;
  const draftCount    = invoices.filter((i) => i.billingStatus === "draft").length;

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">請求管理</h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          全 {invoices.length} 件
        </span>
      </div>

      {/* サマリカード */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">請求総額</p>
          <p className="text-xl font-semibold text-[var(--color-text)] mt-1">
            ¥{totalAmount.toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">入金済み</p>
          <p className="text-xl font-semibold text-[#16A34A] mt-1">
            ¥{paidAmount.toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">期限超過</p>
          <p className="text-xl font-semibold text-[#DC2626] mt-1">
            {overdueCount}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">下書き</p>
          <p className="text-xl font-semibold text-[var(--color-text-sub)] mt-1">
            {draftCount}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
      </div>

      {/* 請求一覧 */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            請求一覧
          </h2>
        </div>

        {invoices.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            請求データがありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">請求番号</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">企業</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">案件</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-[var(--color-text-sub)]">金額</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">ステータス</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">請求日</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">支払期限</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {invoices.map((inv) => {
                  const isOverdue = inv.billingStatus === "overdue";
                  return (
                    <tr key={inv.id} className="hover:bg-[var(--color-accent-tint)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                        {inv.organizationName}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cases/${inv.caseId}/billing`}
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          {inv.caseName}
                        </Link>
                        <p className="text-xs text-[var(--color-text-muted)]">{inv.caseCode}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text)]">
                        {inv.amount != null
                          ? `¥${inv.amount.toLocaleString("ja-JP")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <InvoiceStatusBadge status={inv.billingStatus} />
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                        {inv.invoiceDate
                          ? new Date(inv.invoiceDate).toLocaleDateString("ja-JP", {
                              year: "numeric", month: "2-digit", day: "2-digit",
                              timeZone: "Asia/Tokyo",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {inv.dueDate ? (
                          <span className={isOverdue ? "text-[#DC2626] font-medium" : "text-[var(--color-text-sub)]"}>
                            {new Date(inv.dueDate).toLocaleDateString("ja-JP", {
                              year: "numeric", month: "2-digit", day: "2-digit",
                              timeZone: "Asia/Tokyo",
                            })}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cases/${inv.caseId}/billing`}
                          className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
                        >
                          案件へ →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const label = INVOICE_STATUS_LABELS[status];
  const colorMap: Record<InvoiceStatus, string> = {
    draft:     "text-[var(--color-text-muted)]",
    sent:      "text-[var(--color-accent)] font-medium",
    paid:      "text-[#16A34A] font-medium",
    overdue:   "text-[#DC2626] font-medium",
    cancelled: "text-[var(--color-text-muted)] line-through",
  };
  return <span className={`text-sm ${colorMap[status] ?? "text-[var(--color-text-sub)]"}`}>{label}</span>;
}
