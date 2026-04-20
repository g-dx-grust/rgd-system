/**
 * 内部スタッフ — 不備依頼一覧・対応画面
 * /cases/[id]/deficiencies
 */

import { notFound } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CasePageShell } from "@/components/domain";
import { getCase } from "@/server/repositories/cases";
import { listDeficiencyRequests } from "@/server/repositories/specialist";
import { DeficienciesInternalClient } from "./DeficienciesInternalClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const c = await getCase(id);
  return {
    title: c ? `不備依頼 — ${c.caseName} | RGDシステム` : "不備依頼 | RGDシステム",
  };
}

export default async function CaseDeficienciesPage({ params }: Props) {
  const { id } = await params;
  const [profile, caseData, deficiencies] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
    listDeficiencyRequests(id),
  ]);

  if (!caseData) notFound();

  const canResolve = can(profile?.roleCode, PERMISSIONS.CASE_EDIT);

  return (
    <CasePageShell
      caseId={id}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="deficiencies"
      sectionTitle="不備依頼"
      sectionDescription="社労士が登録した労働局からの不備依頼をここで確認します。"
    >
      <DeficienciesInternalClient
        caseId={id}
        initialDeficiencies={deficiencies}
        canResolve={canResolve}
      />
    </CasePageShell>
  );
}
