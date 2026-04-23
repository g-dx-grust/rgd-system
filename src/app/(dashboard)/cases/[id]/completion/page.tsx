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

import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { getCase } from "@/server/repositories/cases";
import { listSurveys } from "@/server/repositories/surveys";
import { listFinalReviewItems, listFinalSpecialistLinkages } from "@/server/repositories/final-review";
import { checkFinalReadiness } from "@/server/services/final-application";
import { listApplicationPackages } from "@/server/repositories/application-packages";
import { CompletionTabClient } from "./CompletionTabClient";
import { CasePageShell } from "@/components/domain";
import { listExternalSpecialists } from "@/server/repositories/users";

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

  const [surveys, reviewItems, linkages, readiness, allPackages, specialists] = await Promise.all([
    listSurveys(id),
    listFinalReviewItems(id),
    listFinalSpecialistLinkages(id),
    checkFinalReadiness(id),
    listApplicationPackages(id),
    canEdit ? listExternalSpecialists() : Promise.resolve([]),
  ]);

  const finalPackages = allPackages.filter((p) => p.packageType === "final");

  return (
    <CasePageShell
      caseId={id}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="completion"
      sectionTitle="終了申請"
      sectionDescription="終了申請の準備状況と最終提出物を確認します。"
    >
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
        specialists={specialists}
      />
    </CasePageShell>
  );
}
