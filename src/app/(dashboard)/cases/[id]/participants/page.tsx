import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import { listParticipants } from "@/server/repositories/participants";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { ParticipantCsvImport, CasePageShell } from "@/components/domain";
import { LEARNER_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/lib/constants/case-status";
import { FormActionButton } from "@/components/ui";
import { AddParticipantForm } from "./AddParticipantForm";
import { IssueAccountSheetButton } from "./IssueAccountSheetButton";
import { deleteParticipantAction } from "@/server/usecases/participants/actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `受講者管理 - ${c.caseName} | RGDシステム` : "受講者管理 | RGDシステム" };
}

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, caseData, participants] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
    listParticipants(id),
  ]);

  if (!caseData) notFound();

  const canEdit = can(user?.roleCode, PERMISSIONS.TRAINEE_EDIT);

  const active   = participants.filter((p) => p.learnerStatus !== "excluded");
  const excluded = participants.filter((p) => p.learnerStatus === "excluded");

  return (
    <CasePageShell
      caseId={id}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="participants"
      sectionTitle="受講者管理"
      sectionDescription={`対象受講者 ${active.length}名 / アカウント発行シートの出力もここから行えます。`}
      action={<IssueAccountSheetButton caseId={id} disabled={active.length === 0} />}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 受講者テーブル */}
        <div className="lg:col-span-2">
          <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            {active.length === 0 ? (
              <div className="py-16 text-center text-[var(--color-text-muted)] text-sm">
                受講者が未登録です。右のフォームまたはCSVで追加してください。
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                  <tr>
                    {["氏名", "社員番号", "部署", "雇用形態", "入社日", "ステータス"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]"
                      >
                        {h}
                      </th>
                    ))}
                    {canEdit && (
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {active.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-medium text-[var(--color-text)]">{p.name}</p>
                          {p.nameKana && (
                            <p className="text-xs text-[var(--color-text-muted)]">{p.nameKana}</p>
                          )}
                          {p.email && (
                            <p className="text-xs text-[var(--color-text-muted)]">{p.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-text-sub)]">
                        {p.employeeCode ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-text-sub)]">
                        {p.department ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-text-sub)]">
                        {p.employmentType ? (EMPLOYMENT_TYPE_LABELS[p.employmentType] ?? p.employmentType) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-text-sub)]">
                        {p.joinedAt ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={[
                          "text-xs px-2 py-0.5 rounded-[var(--radius-sm)] font-medium",
                          p.learnerStatus === "completed"
                            ? "bg-green-50 text-[#16A34A] border border-green-200"
                            : p.learnerStatus === "active"
                            ? "bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                            : "bg-[var(--color-bg-secondary)] text-[var(--color-text-sub)] border border-[var(--color-border)]",
                        ].join(" ")}>
                          {LEARNER_STATUS_LABELS[p.learnerStatus] ?? p.learnerStatus}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5">
                          <FormActionButton
                            action={deleteParticipantAction}
                            fields={{ caseId: id, participantId: p.id }}
                            label="削除"
                            pendingLabel="削除中..."
                            confirmMessage={`受講者「${p.name}」を削除しますか？`}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 対象外受講者 */}
          {excluded.length > 0 && (
            <details className="mt-4 border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
              <summary className="px-4 py-3 text-sm font-medium text-[var(--color-text-sub)] cursor-pointer hover:bg-[var(--color-bg-secondary)]">
                対象外 ({excluded.length}名)
              </summary>
              <ul className="divide-y divide-[var(--color-border)]">
                {excluded.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                    <div>
                      <span className="line-through">{p.name}</span>
                      {p.excludedReason && (
                        <span className="ml-2 text-xs">（{p.excludedReason}）</span>
                      )}
                    </div>
                    {canEdit && (
                      <FormActionButton
                        action={deleteParticipantAction}
                        fields={{ caseId: id, participantId: p.id }}
                        label="削除"
                        pendingLabel="削除中..."
                        confirmMessage={`対象外受講者「${p.name}」を削除しますか？`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* 右: 追加フォーム */}
        {canEdit && (
          <div className="space-y-5">
            {/* 1件追加 */}
            <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-4">
              <h2 className="text-base font-semibold text-[var(--color-text)]">受講者を追加</h2>
              <AddParticipantForm caseId={id} />
            </section>

            {/* CSV一括登録 */}
            <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-4">
              <h2 className="text-base font-semibold text-[var(--color-text)]">CSV一括登録</h2>
              <ParticipantCsvImport caseId={id} />
            </section>
          </div>
        )}
      </div>
    </CasePageShell>
  );
}
