import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import { listTasks } from "@/server/repositories/tasks";
import { countParticipants } from "@/server/repositories/participants";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CasePageShell, NextBestAction } from "@/components/domain";
import { ButtonLink, FormActionButton } from "@/components/ui";
import { computeNextBestAction } from "@/server/services/cases";
import { CASE_STATUS_LABELS } from "@/lib/constants/case-status";
import { AcceptanceDateFormClient } from "./AcceptanceDateFormClient";
import { TaskPanelClient } from "./TaskPanelClient";
import { deleteCaseAction } from "@/server/usecases/cases/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCase(id);
  return {
    title: c ? `${c.caseName} | RGDシステム` : "案件詳細 | RGDシステム",
  };
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

  const canEdit = can(user?.roleCode, PERMISSIONS.CASE_EDIT);
  const canDelete = can(user?.roleCode, PERMISSIONS.CASE_DELETE);
  const canStatusChange = can(user?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE);
  const canManageTasks = can(user?.roleCode, PERMISSIONS.TASK_MANAGE);
  const nextAction = computeNextBestAction(tasks);

  const openTasks = tasks.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  );

  return (
    <CasePageShell
      caseId={id}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="overview"
      sectionTitle="案件概要"
      sectionDescription="現在の案件状況と対応タスクを確認できます。"
      action={
        canEdit || canDelete ? (
          <div className="flex items-center gap-2">
            {canEdit && (
              <ButtonLink
                href={`/cases/${id}/edit`}
                variant="secondary"
                size="sm"
              >
                編集
              </ButtonLink>
            )}
            {canDelete && (
              <FormActionButton
                action={deleteCaseAction}
                fields={{ caseId: id }}
                label="削除"
                pendingLabel="削除中..."
                confirmMessage={`案件「${caseData.caseName}」を削除しますか？関連する受講者や進行データは一覧から見えなくなります。`}
              />
            )}
          </div>
        ) : null
      }
    >
      <NextBestAction message={nextAction} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左: 案件情報 */}
        <div className="space-y-5 lg:col-span-2">
          {/* 基本情報 */}
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
            <h2 className="mb-4 text-base font-semibold text-[var(--color-text)]">
              基本情報
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="助成金種別" value={caseData.subsidyProgramName} />
              <InfoRow label="契約日" value={caseData.contractDate} />
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
              <InfoRow label="受理日" value={caseData.acceptanceDate} />
              <InfoRow label="主担当" value={caseData.ownerName} />
            </dl>
            {caseData.summary && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <p className="mb-1 text-xs font-semibold text-[var(--color-text-sub)]">
                  概要メモ
                </p>
                <p className="text-sm whitespace-pre-wrap text-[var(--color-text-sub)]">
                  {caseData.summary}
                </p>
              </div>
            )}
          </section>

          {/* タスク一覧 */}
          <section
            id="tasks"
            className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                タスク
                {openTasks.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-[var(--color-error)]">
                    未完了 {openTasks.length}件
                  </span>
                )}
              </h2>
            </div>
            <TaskPanelClient
              caseId={id}
              tasks={tasks}
              canManageTasks={canManageTasks}
            />
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
          <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              受講者
            </h2>
            <p className="text-2xl font-semibold text-[var(--color-text)]">
              {participantCount}
              <span className="ml-1 text-sm font-normal text-[var(--color-text-muted)]">
                名
              </span>
            </p>
            <ButtonLink
              href={`/cases/${id}/participants`}
              variant="secondary"
              size="sm"
            >
              受講者を管理
            </ButtonLink>
          </section>
        </div>
      </div>
    </CasePageShell>
  );
}

// ---------------------------------------------------------------
// ステータス変更パネル（Server Component — フォームは action 経由）
// ---------------------------------------------------------------
function StatusChangePanel({
  currentStatus,
}: {
  caseId: string;
  currentStatus: string;
}) {
  return (
    <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <h2 className="text-base font-semibold text-[var(--color-text)]">
        ステータス
      </h2>
      <p className="text-sm text-[var(--color-text-sub)]">
        現在:{" "}
        <strong>
          {CASE_STATUS_LABELS[
            currentStatus as keyof typeof CASE_STATUS_LABELS
          ] ?? currentStatus}
        </strong>
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
      <dd
        className={[
          "mt-0.5 text-sm",
          highlight
            ? "font-medium text-[var(--color-warning)]"
            : "text-[var(--color-text)]",
        ].join(" ")}
      >
        {value ?? "—"}
        {highlight && " ⚠"}
      </dd>
    </div>
  );
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const due = new Date(dateStr);
  const now = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= 7;
}
