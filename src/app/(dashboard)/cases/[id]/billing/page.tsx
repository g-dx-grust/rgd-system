/**
 * 案件詳細 — 請求タブ
 *
 * 請求一覧・請求状態管理。
 * 新規請求の作成・ステータス更新をServer Actionで行う。
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  listInvoices,
  INVOICE_STATUS_LABELS,
} from "@/server/repositories/invoices";
import type { InvoiceRow } from "@/server/repositories/invoices";
import { getCase } from "@/server/repositories/cases";
import { createClient } from "@/lib/supabase/server";
import { isMissingStorageBucketError } from "@/lib/supabase/errors";
import { BillingFormClient } from "./BillingFormClient";
import { InvoiceUploadClient } from "./InvoiceUploadClient";
import { updateInvoiceStatusAction } from "@/server/usecases/invoices/actions";
import { CasePageShell } from "@/components/domain";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BillingPage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { id: caseId } = await params;

  const supabase = await createClient();

  const [caseData, invoices] = await Promise.all([
    getCase(caseId),
    listInvoices(caseId),
  ]);

  // 署名付きURLを一括生成
  const filePaths = invoices
    .filter((i) => i.filePath)
    .map((i) => i.filePath as string);
  const signedUrlMap: Record<string, string> = {};
  let isInvoiceFileFeatureAvailable = true;
  if (filePaths.length > 0) {
    const { data: signedUrls, error: signedUrlError } = await supabase.storage
      .from("invoice-files")
      .createSignedUrls(filePaths, 3600);
    if (signedUrlError) {
      if (isMissingStorageBucketError(signedUrlError, ["invoice-files"])) {
        isInvoiceFileFeatureAvailable = false;
      } else {
        throw new Error(signedUrlError.message);
      }
    }
    (signedUrls ?? []).forEach((s) => {
      if (s.path && s.signedUrl) signedUrlMap[s.path] = s.signedUrl;
    });
  }

  if (!caseData) notFound();

  const canEdit = can(profile.roleCode, PERMISSIONS.BILLING_REGISTER);

  return (
    <CasePageShell
      caseId={caseId}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="billing"
      sectionTitle="請求管理"
      sectionDescription="請求登録と入金状況を管理します。"
    >
      {!caseData.acceptanceDate && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            受理日が登録されていません。受理日を登録してから請求管理を行ってください。
          </p>
        </div>
      )}

      <InvoiceSummary invoices={invoices} />

      <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            請求一覧
          </h2>
        </div>

        {invoices.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            請求はまだ登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  請求番号
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  請求日
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  支払期限
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  金額
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  ステータス
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  ファイル
                </th>
                {canEdit && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {invoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  caseId={caseId}
                  canEdit={canEdit}
                  fileSignedUrl={
                    inv.filePath ? (signedUrlMap[inv.filePath] ?? null) : null
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canEdit && <BillingFormClient caseId={caseId} />}

      {canEdit && (
        <InvoiceUploadClient
          caseId={caseId}
          isFeatureAvailable={isInvoiceFileFeatureAvailable}
        />
      )}
    </CasePageShell>
  );
}

// ---------------------------------------------------------------
// 請求サマリー
// ---------------------------------------------------------------
function InvoiceSummary({ invoices }: { invoices: InvoiceRow[] }) {
  const total = invoices.length;
  const sent = invoices.filter((i) => i.billingStatus === "sent").length;
  const paid = invoices.filter((i) => i.billingStatus === "paid").length;
  const overdue = invoices.filter((i) => i.billingStatus === "overdue").length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard label="合計" value={total} />
      <SummaryCard label="送付済み" value={sent} accent />
      <SummaryCard label="入金確認済み" value={paid} success />
      <SummaryCard label="期限超過" value={overdue} error={overdue > 0} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  success,
  error,
}: {
  label: string;
  value: number;
  accent?: boolean;
  success?: boolean;
  error?: boolean;
}) {
  const textColor = error
    ? "text-[var(--color-error)]"
    : success
      ? "text-[#16A34A]"
      : accent
        ? "text-[var(--color-accent)]"
        : "text-[var(--color-text)]";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <p className="mb-1 text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={["text-2xl font-semibold", textColor].join(" ")}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------
// 請求行コンポーネント（ステータス変更フォーム含む）
// ---------------------------------------------------------------
function InvoiceRow({
  invoice,
  caseId,
  canEdit,
  fileSignedUrl,
}: {
  invoice: InvoiceRow;
  caseId: string;
  canEdit: boolean;
  fileSignedUrl: string | null;
}) {
  const statusColor =
    invoice.billingStatus === "paid"
      ? "text-[#16A34A]"
      : invoice.billingStatus === "overdue"
        ? "text-[var(--color-error)]"
        : invoice.billingStatus === "sent"
          ? "text-[var(--color-accent)]"
          : invoice.billingStatus === "cancelled"
            ? "text-[var(--color-text-muted)]"
            : "text-[var(--color-text-sub)]";

  const isOverdue =
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date() &&
    invoice.billingStatus === "sent";

  return (
    <tr className="hover:bg-[var(--color-bg-secondary)]">
      <td className="px-4 py-3 font-medium text-[var(--color-text)]">
        {invoice.invoiceNumber}
      </td>
      <td className="px-4 py-3 text-[var(--color-text-sub)]">
        {invoice.invoiceDate ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            isOverdue
              ? "font-medium text-[var(--color-error)]"
              : "text-[var(--color-text-sub)]"
          }
        >
          {invoice.dueDate ?? "—"}
          {isOverdue && " ⚠"}
        </span>
      </td>
      <td className="px-4 py-3 text-[var(--color-text-sub)]">
        {invoice.amount != null ? `¥${invoice.amount.toLocaleString()}` : "—"}
      </td>
      <td className="px-4 py-3">
        <span className={["text-sm font-medium", statusColor].join(" ")}>
          {INVOICE_STATUS_LABELS[invoice.billingStatus]}
        </span>
      </td>
      <td className="px-4 py-3">
        {fileSignedUrl ? (
          <a
            href={fileSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            {invoice.fileName ?? "ダウンロード"}
          </a>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">—</span>
        )}
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <InvoiceStatusActions invoice={invoice} caseId={caseId} />
        </td>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------
// ステータス変更ボタン群（次のアクションのみ表示）
// ---------------------------------------------------------------
function InvoiceStatusActions({
  invoice,
  caseId,
}: {
  invoice: InvoiceRow;
  caseId: string;
}) {
  type NextAction = { status: string; label: string };
  const nextActions: NextAction[] = [];

  if (invoice.billingStatus === "draft") {
    nextActions.push({ status: "sent", label: "送付済みにする" });
    nextActions.push({ status: "cancelled", label: "キャンセル" });
  } else if (invoice.billingStatus === "sent") {
    nextActions.push({ status: "paid", label: "入金確認済みにする" });
    nextActions.push({ status: "overdue", label: "期限超過にする" });
    nextActions.push({ status: "cancelled", label: "キャンセル" });
  } else if (invoice.billingStatus === "overdue") {
    nextActions.push({ status: "paid", label: "入金確認済みにする" });
  }

  if (nextActions.length === 0)
    return <span className="text-xs text-[var(--color-text-muted)]">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextActions.map((act) => (
        <form
          key={act.status}
          action={
            updateInvoiceStatusAction.bind(null, null) as unknown as (
              fd: FormData
            ) => Promise<void>
          }
        >
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <input type="hidden" name="billingStatus" value={act.status} />
          <button
            type="submit"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            {act.label}
          </button>
        </form>
      ))}
    </div>
  );
}
