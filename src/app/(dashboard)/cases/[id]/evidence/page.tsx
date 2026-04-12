/**
 * 案件詳細 — 証憑タブ
 *
 * 証憑の一覧・回収状態管理。
 * 新規証憑の登録・ステータス更新をServer Actionで行う。
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  listEvidenceItems,
  getEvidenceSummary,
  EVIDENCE_TYPE_LABELS,
  EVIDENCE_STATUS_LABELS,
} from "@/server/repositories/evidence-items";
import type { EvidenceItemRow } from "@/server/repositories/evidence-items";
import { createClient } from "@/lib/supabase/server";
import { EvidenceFormClient } from "./EvidenceFormClient";
import { updateEvidenceStatusAction } from "@/server/usecases/evidence/actions";
import { CaseTabNav } from "@/components/domain";

interface Props {
  params: Promise<{ id: string }>;
}

async function getCaseBasic(caseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("id, case_code, case_name, acceptance_date")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
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

export default async function EvidencePage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { id: caseId } = await params;

  const [caseData, evidenceItems, summary, participants] = await Promise.all([
    getCaseBasic(caseId),
    listEvidenceItems(caseId),
    getEvidenceSummary(caseId),
    getCaseParticipants(caseId),
  ]);

  if (!caseData) notFound();

  const canEdit = can(profile.roleCode, PERMISSIONS.DOCUMENT_UPLOAD);

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${caseId}`} className="hover:text-[var(--color-accent)]">
          {caseData.case_code as string}
        </Link>
        <span>/</span>
        <span>証憑管理</span>
      </div>

      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
        {caseData.case_name as string}
        <span className="ml-2 text-base font-normal text-[var(--color-text-muted)]">証憑管理</span>
      </h1>

      {/* タブナビ */}
      <CaseTabNav caseId={caseId} activeTab="evidence" />

      {/* 受理日未登録の警告 */}
      {!caseData.acceptance_date && (
        <div className="border border-[var(--color-warning)] bg-amber-50 rounded-[var(--radius-md)] px-4 py-3">
          <p className="text-sm text-amber-800">
            受理日が登録されていません。受理日を登録してから証憑管理を行ってください。
          </p>
        </div>
      )}

      {/* 証憑充足サマリー */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="合計"     value={summary.total} />
          <SummaryCard label="依頼中"   value={summary.pending}      warn={summary.pending > 0} />
          <SummaryCard label="回収済み" value={summary.collected}    accent />
          <SummaryCard label="確認済み" value={summary.confirmed}    success />
        </div>
      )}
      {summary.insufficient > 0 && (
        <div className="border border-[var(--color-error)] bg-red-50 rounded-[var(--radius-md)] px-4 py-3">
          <p className="text-sm text-red-800">
            不足・不備の証憑が {summary.insufficient} 件あります。再依頼してください。
          </p>
        </div>
      )}

      {/* 証憑一覧 */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">証憑一覧</h2>
        </div>

        {evidenceItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            証憑はまだ登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">証憑名</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">種別</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">受講者</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">回収期限</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">状態</th>
                {canEdit && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {evidenceItems.map((item) => (
                <EvidenceRow key={item.id} item={item} caseId={caseId} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 証憑追加フォーム */}
      {canEdit && (
        <EvidenceFormClient caseId={caseId} participants={participants} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 証憑行
// ---------------------------------------------------------------
function EvidenceRow({
  item, caseId, canEdit,
}: {
  item:    EvidenceItemRow;
  caseId:  string;
  canEdit: boolean;
}) {
  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status === "pending";

  const statusColor =
    item.status === "confirmed"    ? "text-[#16A34A]" :
    item.status === "collected"    ? "text-[var(--color-accent)]" :
    item.status === "insufficient" ? "text-[var(--color-error)]" :
    "text-[var(--color-text-muted)]";

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
      <td className="px-4 py-3 font-medium text-[var(--color-text)]">{item.title}</td>
      <td className="px-4 py-3 text-[var(--color-text-sub)]">
        {EVIDENCE_TYPE_LABELS[item.evidenceType]}
      </td>
      <td className="px-4 py-3 text-[var(--color-text-sub)]">
        {item.participantName ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span className={isOverdue ? "text-[var(--color-error)] font-medium" : "text-[var(--color-text-sub)]"}>
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
          {nextActions.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {nextActions.map((act) => (
                <form key={act.status} action={updateEvidenceStatusAction.bind(null, null) as unknown as (fd: FormData) => Promise<void>}>
                  <input type="hidden" name="caseId"      value={caseId} />
                  <input type="hidden" name="evidenceId"  value={item.id} />
                  <input type="hidden" name="status"      value={act.status} />
                  <button type="submit" className="text-xs text-[var(--color-accent)] hover:underline">
                    {act.label}
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">—</span>
          )}
        </td>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------
// サマリーカード
// ---------------------------------------------------------------
function SummaryCard({
  label, value, accent, success, warn,
}: {
  label: string; value: number;
  accent?: boolean; success?: boolean; warn?: boolean;
}) {
  const textColor = success ? "text-[#16A34A]"
    : warn   ? "text-[var(--color-warning)]"
    : accent ? "text-[var(--color-accent)]"
    : "text-[var(--color-text)]";

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-3">
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={["text-2xl font-semibold", textColor].join(" ")}>{value}</p>
    </div>
  );
}

