/**
 * 案件詳細 — 証憑タブ
 *
 * 証憑の一覧・回収状態管理。
 * 新規証憑の登録・ステータス更新をServer Actionで行う。
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  listEvidenceItems,
  getEvidenceSummary,
  EVIDENCE_TYPE_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "@/server/repositories/evidence-items";
import type { EvidenceItemRow } from "@/server/repositories/evidence-items";
import { getCase } from "@/server/repositories/cases";
import { createClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/errors";
import { EvidenceFormClient } from "./EvidenceFormClient";
import { CompletionCertClient } from "./CompletionCertClient";
import {
  updateEvidenceStatusAction,
  deleteEvidenceItemAction,
} from "@/server/usecases/evidence/actions";
import { CasePageShell } from "@/components/domain";
import { FormActionButton } from "@/components/ui";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type CompletionCertificateRow = {
  id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
};

interface Props {
  params: Promise<{ id: string }>;
}

async function getCaseParticipants(caseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("participants")
    .select("id, name")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .neq("learner_status", "excluded")
    .order("name");
  return (data ?? []) as { id: string; name: string }[];
}

async function listCompletionCertificates(
  supabase: SupabaseClient,
  caseId: string
): Promise<{ available: boolean; rows: CompletionCertificateRow[] }> {
  const { data, error } = await supabase
    .from("case_completion_certificates")
    .select("id, file_path, file_name, uploaded_at")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    if (
      isMissingSupabaseRelationError(error, ["case_completion_certificates"])
    ) {
      return { available: false, rows: [] };
    }
    throw new Error(error.message);
  }

  return { available: true, rows: (data ?? []) as CompletionCertificateRow[] };
}

export default async function EvidencePage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { id: caseId } = await params;

  const supabase = await createClient();

  const [
    caseData,
    evidenceItems,
    summary,
    participants,
    completionCertificates,
  ] = await Promise.all([
    getCase(caseId),
    listEvidenceItems(caseId),
    getEvidenceSummary(caseId),
    getCaseParticipants(caseId),
    listCompletionCertificates(supabase, caseId),
  ]);

  const certRows = completionCertificates.rows;
  const certFilePaths = certRows.map((r) => r.file_path);
  const certSignedUrlMap: Record<string, string> = {};
  if (completionCertificates.available && certFilePaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("completion-certificates")
      .createSignedUrls(certFilePaths, 3600);
    (signedUrls ?? []).forEach((s) => {
      if (s.path && s.signedUrl) certSignedUrlMap[s.path] = s.signedUrl;
    });
  }
  const certs = certRows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    uploadedAt: r.uploaded_at,
    signedUrl: certSignedUrlMap[r.file_path] ?? null,
  }));

  if (!caseData) notFound();

  const canEdit = can(profile.roleCode, PERMISSIONS.DOCUMENT_UPLOAD);

  return (
    <CasePageShell
      caseId={caseId}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="evidence"
      sectionTitle="証憑管理"
      sectionDescription="証憑の回収状況と修了証を管理します。"
    >
      {!caseData.acceptanceDate && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            受理日が登録されていません。受理日を登録してから証憑管理を行ってください。
          </p>
        </div>
      )}

      {summary.total > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="合計" value={summary.total} />
          <SummaryCard
            label="依頼中"
            value={summary.pending}
            warn={summary.pending > 0}
          />
          <SummaryCard label="回収済み" value={summary.collected} accent />
          <SummaryCard label="確認済み" value={summary.confirmed} success />
        </div>
      )}
      {summary.insufficient > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-error)] bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">
            不足・不備の証憑が {summary.insufficient}{" "}
            件あります。再依頼してください。
          </p>
        </div>
      )}

      <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            証憑一覧
          </h2>
        </div>

        {evidenceItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            証憑はまだ登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  証憑名
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  種別
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  受講者
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  回収期限
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  状態
                </th>
                {canEdit && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {evidenceItems.map((item) => (
                <EvidenceRow
                  key={item.id}
                  item={item}
                  caseId={caseId}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canEdit && (
        <EvidenceFormClient caseId={caseId} participants={participants} />
      )}

      {canEdit && (
        <CompletionCertClient
          caseId={caseId}
          certs={certs}
          isFeatureAvailable={completionCertificates.available}
        />
      )}
    </CasePageShell>
  );
}

// ---------------------------------------------------------------
// 証憑行
// ---------------------------------------------------------------
function EvidenceRow({
  item,
  caseId,
  canEdit,
}: {
  item: EvidenceItemRow;
  caseId: string;
  canEdit: boolean;
}) {
  const isOverdue =
    item.dueDate &&
    new Date(item.dueDate) < new Date() &&
    item.status === "pending";

  const statusColor =
    item.status === "confirmed"
      ? "text-[#16A34A]"
      : item.status === "collected"
        ? "text-[var(--color-accent)]"
        : item.status === "insufficient"
          ? "text-[var(--color-error)]"
          : "text-[var(--color-text-muted)]";

  type NextAction = { status: string; label: string };
  const nextActions: NextAction[] = [];
  if (item.status === "pending") {
    nextActions.push({ status: "collected", label: "回収済み" });
    nextActions.push({ status: "insufficient", label: "不足・不備" });
  } else if (item.status === "collected") {
    nextActions.push({ status: "confirmed", label: "確認済みにする" });
    nextActions.push({ status: "insufficient", label: "不足・不備" });
  } else if (item.status === "insufficient") {
    nextActions.push({ status: "pending", label: "依頼中に戻す" });
  }

  return (
    <tr className="hover:bg-[var(--color-bg-secondary)]">
      <td className="px-4 py-3 font-medium text-[var(--color-text)]">
        {item.title}
      </td>
      <td className="px-4 py-3 text-[var(--color-text-sub)]">
        {EVIDENCE_TYPE_LABELS[item.evidenceType]}
      </td>
      <td className="px-4 py-3 text-[var(--color-text-sub)]">
        {item.participantName ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            isOverdue
              ? "font-medium text-[var(--color-error)]"
              : "text-[var(--color-text-sub)]"
          }
        >
          {item.dueDate ?? "—"}
          {isOverdue && " ⚠"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={["text-sm font-medium", statusColor].join(" ")}>
          {EVIDENCE_STATUS_LABELS[item.status]}
        </span>
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {nextActions.map((act) => (
              <form
                key={act.status}
                action={
                  updateEvidenceStatusAction.bind(null, null) as unknown as (
                    fd: FormData
                  ) => Promise<void>
                }
              >
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="evidenceId" value={item.id} />
                <input type="hidden" name="status" value={act.status} />
                <button
                  type="submit"
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  {act.label}
                </button>
              </form>
            ))}
            <FormActionButton
              action={deleteEvidenceItemAction}
              fields={{ caseId, evidenceId: item.id }}
              label="削除"
              pendingLabel="削除中..."
              confirmMessage={`証憑「${item.title}」を削除しますか？`}
            />
            {nextActions.length === 0 && (
              <span className="text-xs text-[var(--color-text-muted)]">状態変更なし</span>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------
// サマリーカード
// ---------------------------------------------------------------
function SummaryCard({
  label,
  value,
  accent,
  success,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  success?: boolean;
  warn?: boolean;
}) {
  const textColor = success
    ? "text-[#16A34A]"
    : warn
      ? "text-[var(--color-warning)]"
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
