import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import { listTasks } from "@/server/repositories/tasks";
import { countParticipants } from "@/server/repositories/participants";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CaseStatusBadge, NextBestAction } from "@/components/domain";
import { ButtonLink } from "@/components/ui";
import { computeNextBestAction } from "@/server/services/cases";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, CASE_STATUS_LABELS } from "@/lib/constants/case-status";
import { AcceptanceDateFormClient } from "./AcceptanceDateFormClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `${c.caseName} | RGDシステム` : "案件詳細 | RGDシステム" };
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, caseData, tasks, participantCount] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
    listTasks(id),
    countParticipants(id),
  ]);

  if (!caseData) notFound();

  const canEdit         = can(user?.roleCode, PERMISSIONS.CASE_EDIT);
  const canStatusChange = can(user?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE);
  const nextAction      = computeNextBestAction(tasks);

  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress");

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <span>{caseData.caseCode}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-semibold text-[var(--color-text)]">{caseData.caseName}</h1>
            <CaseStatusBadge status={caseData.status} />
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {caseData.caseCode}　/
            <Link
              href={`/organizations/${caseData.organizationId}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {caseData.organizationName}
            </Link>
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <ButtonLink href={`/cases/${id}/edit`} variant="secondary" size="sm">
              編集
            </ButtonLink>
          </div>
        )}
      </div>

      {/* Next Best Action */}
      <NextBestAction message={nextAction} />

      {/* タブナビ */}
      <nav className="flex border-b border-[var(--color-border)] gap-0 overflow-x-auto">
        {[
          { label: "概要",     href: `/cases/${id}`,              active: true },
          { label: `受講者 (${participantCount})`, href: `/cases/${id}/participants`, active: false },
          { label: "書類",     href: `/cases/${id}/documents`,    active: false },
          { label: "申請",     href: `/cases/${id}/applications`, active: false },
          { label: "請求",     href: `/cases/${id}/billing`,      active: false },
          { label: "証憑",     href: `/cases/${id}/evidence`,     active: false },
          { label: "開始案内", href: `/cases/${id}/messages`,     active: false },
          { label: "LMS進捗",  href: `/cases/${id}/lms`,          active: false },
          { label: "終了申請", href: `/cases/${id}/completion`,   active: false },
          { label: "変更履歴", href: `/cases/${id}/timeline`,     active: false },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={[
              "px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap",
              tab.active
                ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
                : "border-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* コンテンツエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 案件情報 */}
        <div className="lg:col-span-2 space-y-5">
          {/* 基本情報 */}
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">基本情報</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="助成金種別"  value={caseData.subsidyProgramName} />
              <InfoRow label="契約日"      value={caseData.contractDate} />
              <InfoRow label="受講開始予定" value={caseData.plannedStartDate} />
              <InfoRow label="受講終了予定" value={caseData.plannedEndDate} />
              <InfoRow
                label="初回申請期限"
                value={caseData.preApplicationDueDate}
                highlight={isDueSoon(caseData.preApplicationDueDate)}
              />
              <InfoRow
                label="最終申請期限"
                value={caseData.finalApplicationDueDate}
                highlight={isDueSoon(caseData.finalApplicationDueDate)}
              />
              <InfoRow label="受理日"      value={caseData.acceptanceDate} />
              <InfoRow label="主担当"      value={caseData.ownerName} />
            </dl>
            {caseData.summary && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-sub)] mb-1">概要メモ</p>
                <p className="text-sm text-[var(--color-text-sub)] whitespace-pre-wrap">{caseData.summary}</p>
              </div>
            )}
          </section>

          {/* タスク一覧 */}
          <section id="tasks" className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                タスク
                {openTasks.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-[var(--color-error)]">
                    未完了 {openTasks.length}件
                  </span>
                )}
              </h2>
            </div>

            {openTasks.length === 0 && tasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                タスクがありません。
              </div>
            ) : openTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                未完了のタスクはありません。
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {openTasks.map((task) => (
                  <li key={task.id} className="px-4 py-3 flex items-start gap-3">
                    <StatusDot status={task.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                        <span className={[
                          "font-medium",
                          task.priority === "critical" ? "text-[var(--color-error)]" :
                          task.priority === "high"     ? "text-[var(--color-warning)]" : "",
                        ].join(" ")}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                        {task.dueDate && <span>期限: {task.dueDate}</span>}
                        {task.assigneeName && <span>担当: {task.assigneeName}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 右: サイドバー情報 */}
        <div className="space-y-4">
          {/* ステータス変更 */}
          {canStatusChange && (
            <StatusChangePanel caseId={id} currentStatus={caseData.status} />
          )}

          {/* 受理日登録 */}
          {canEdit && (
            <AcceptanceDateFormClient
              caseId={id}
              currentAcceptanceDate={caseData.acceptanceDate}
            />
          )}

          {/* 受講者サマリー */}
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
            <h2 className="text-base font-semibold text-[var(--color-text)]">受講者</h2>
            <p className="text-2xl font-semibold text-[var(--color-text)]">
              {participantCount}
              <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">名</span>
            </p>
            <ButtonLink href={`/cases/${id}/participants`} variant="secondary" size="sm">
              受講者を管理
            </ButtonLink>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// ステータス変更パネル（Server Component — フォームは action 経由）
// ---------------------------------------------------------------
function StatusChangePanel({ currentStatus }: { caseId: string; currentStatus: string }) {
  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
      <h2 className="text-base font-semibold text-[var(--color-text)]">ステータス</h2>
      <p className="text-sm text-[var(--color-text-sub)]">
        現在: <strong>{CASE_STATUS_LABELS[currentStatus as keyof typeof CASE_STATUS_LABELS] ?? currentStatus}</strong>
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        ステータスを変更するには、遷移候補を確認してください。
      </p>
    </section>
  );
}

// ---------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------
function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className={["text-sm mt-0.5", highlight ? "text-[var(--color-warning)] font-medium" : "text-[var(--color-text)]"].join(" ")}>
        {value ?? "—"}
        {highlight && " ⚠"}
      </dd>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"        ? "bg-[#16A34A]" :
    status === "in_progress" ? "bg-[var(--color-accent)]" :
    status === "skipped"     ? "bg-[var(--color-border-strong)]" :
    "bg-[var(--color-warning)]";

  return (
    <span
      className={["mt-1.5 w-2 h-2 rounded-full flex-shrink-0", color].join(" ")}
      aria-hidden="true"
    />
  );
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const due  = new Date(dateStr);
  const now  = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= 7;
}
