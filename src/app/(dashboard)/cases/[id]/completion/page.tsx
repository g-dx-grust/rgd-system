/**
 * 案件詳細 — 終了申請タブ
 *
 * /cases/[id]/completion
 *
 * FR-070〜FR-072:
 * - アンケート回収状況
 * - 終了申請準備チェックリスト
 * - 最終申請パッケージ
 * - 最終社労士連携履歴
 * - final_application_shared → completed 遷移制御
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { getCase } from "@/server/repositories/cases";
import { listSurveys } from "@/server/repositories/surveys";
import { listFinalReviewItems, listFinalSpecialistLinkages } from "@/server/repositories/final-review";
import { checkFinalReadiness } from "@/server/services/final-application";
import { listApplicationPackages } from "@/server/repositories/application-packages";
import { CASE_STATUS_LABELS } from "@/lib/constants/case-status";
import { CompletionTabClient } from "./CompletionTabClient";
import { CaseTabNav } from "@/components/domain";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `終了申請 | ${c.caseName} | RGDシステム` : "終了申請 | RGDシステム" };
}

export default async function CompletionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const caseData = await getCase(id);

  if (!caseData) notFound();

  const canEdit         = can(profile.roleCode, PERMISSIONS.CASE_EDIT);
  const canStatusChange = can(profile.roleCode, PERMISSIONS.CASE_STATUS_CHANGE);

  const [surveys, reviewItems, linkages, readiness, allPackages] = await Promise.all([
    listSurveys(id),
    listFinalReviewItems(id),
    listFinalSpecialistLinkages(id),
    checkFinalReadiness(id),
    listApplicationPackages(id),
  ]);

  const finalPackages = allPackages.filter((p) => p.packageType === "final");

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${id}`} className="hover:text-[var(--color-accent)]">
          {caseData.caseCode}
        </Link>
        <span>/</span>
        <span>終了申請</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
            {caseData.caseName}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {caseData.caseCode}　/
            <Link
              href={`/organizations/${caseData.organizationId}`}
              className="text-[var(--color-accent)] hover:underline"
            >
              {caseData.organizationName}
            </Link>
            　/　{CASE_STATUS_LABELS[caseData.status as keyof typeof CASE_STATUS_LABELS] ?? caseData.status}
          </p>
        </div>
      </div>

      {/* タブナビ */}
      <CaseTabNav caseId={id} activeTab="completion" />

      {/* コンテンツ */}
      <CompletionTabClient
        caseId={id}
        caseStatus={caseData.status}
        surveys={surveys}
        reviewItems={reviewItems}
        linkages={linkages}
        readiness={readiness}
        finalPackages={finalPackages}
        canEdit={canEdit}
        canStatusChange={canStatusChange}
      />
    </div>
  );
}
