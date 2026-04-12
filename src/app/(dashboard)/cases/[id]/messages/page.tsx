/**
 * 案件詳細 — 開始案内タブ
 *
 * テンプレートから開始案内を作成し、送信履歴を管理する。
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  listMessageTemplates,
  listSentMessages,
  TEMPLATE_TYPE_LABELS,
} from "@/server/repositories/message-templates";
import type { SentMessageRow } from "@/server/repositories/message-templates";
import { getCase } from "@/server/repositories/cases";
import { MessageComposeClient } from "./MessageComposeClient";
import { CaseTabNav } from "@/components/domain";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MessagesPage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { id: caseId } = await params;

  const [caseData, templates, sentMessages] = await Promise.all([
    getCase(caseId),
    listMessageTemplates(),
    listSentMessages(caseId),
  ]);

  if (!caseData) notFound();

  const canSend = can(profile.roleCode, PERMISSIONS.CASE_EDIT);

  // 開始案内テンプレートを先頭に表示
  const startGuideTemplates = templates.filter((t) => t.templateType === "start_guide");
  const otherTemplates      = templates.filter((t) => t.templateType !== "start_guide");
  const sortedTemplates     = [...startGuideTemplates, ...otherTemplates];

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${caseId}`} className="hover:text-[var(--color-accent)]">
          {caseData.caseCode}
        </Link>
        <span>/</span>
        <span>開始案内</span>
      </div>

      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
        {caseData.caseName}
        <span className="ml-2 text-base font-normal text-[var(--color-text-muted)]">開始案内</span>
      </h1>

      {/* タブナビ */}
      <CaseTabNav caseId={caseId} activeTab="messages" />

      {/* 受理日未登録の警告 */}
      {!caseData.acceptanceDate && (
        <div className="border border-[var(--color-warning)] bg-amber-50 rounded-[var(--radius-md)] px-4 py-3">
          <p className="text-sm text-amber-800">
            受理日が登録されていません。受理日を登録してから開始案内を送付してください。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: テンプレート選択 + 送信フォーム */}
        <div className="lg:col-span-2">
          {canSend ? (
            <MessageComposeClient
              caseId={caseId}
              templates={sortedTemplates}
              caseInfo={{
                caseName:          caseData.caseName,
                organizationName:  caseData.organizationName,
                acceptanceDate:    caseData.acceptanceDate,
                plannedStartDate:  caseData.plannedStartDate,
                plannedEndDate:    caseData.plannedEndDate,
              }}
            />
          ) : (
            <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                メッセージ送信の権限がありません。
              </p>
            </div>
          )}
        </div>

        {/* 右: 送信履歴 */}
        <div>
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                送信履歴
                <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                  ({sentMessages.length}件)
                </span>
              </h2>
            </div>

            {sentMessages.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                送信履歴はありません。
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {sentMessages.map((msg) => (
                  <SentMessageItem key={msg.id} msg={msg} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// 送信履歴行
// ---------------------------------------------------------------
function SentMessageItem({ msg }: { msg: SentMessageRow }) {
  const sentDate = new Date(msg.sentAt).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const templateLabel = TEMPLATE_TYPE_LABELS[msg.templateType as keyof typeof TEMPLATE_TYPE_LABELS]
    ?? msg.templateType;

  return (
    <li className="px-4 py-3 space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)] shrink-0">
          {templateLabel}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{sentDate}</span>
      </div>
      <p className="text-sm font-medium text-[var(--color-text)] truncate">{msg.subject}</p>
      {msg.sentTo && (
        <p className="text-xs text-[var(--color-text-muted)]">宛先: {msg.sentTo}</p>
      )}
      {msg.sentByName && (
        <p className="text-xs text-[var(--color-text-muted)]">送付者: {msg.sentByName}</p>
      )}
    </li>
  );
}

