import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CaseEditForm } from "./CaseEditForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `${c.caseName} 編集 | RGDシステム` : "案件編集 | RGDシステム" };
}

export default async function CaseEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, caseData] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
  ]);

  if (!caseData) notFound();
  if (!can(user?.roleCode, PERMISSIONS.CASE_EDIT)) notFound();

  return (
    <CaseEditForm
      caseId={id}
      initialValues={{
        caseName:               caseData.caseName,
        organizationId:         caseData.organizationId,
        organizationName:       caseData.organizationName,
        subsidyProgramId:       caseData.subsidyProgramId,
        videoCourseId:          caseData.videoCourseId,
        contractDate:           caseData.contractDate,
        plannedStartDate:       caseData.plannedStartDate,
        plannedEndDate:         caseData.plannedEndDate,
        preApplicationDueDate:  caseData.preApplicationDueDate,
        finalApplicationDueDate: caseData.finalApplicationDueDate,
        ownerUserId:            caseData.ownerUserId,
        summary:                caseData.summary,
      }}
    />
  );
}
