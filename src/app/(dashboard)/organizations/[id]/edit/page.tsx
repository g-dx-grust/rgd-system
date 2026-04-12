import { notFound } from "next/navigation";
import { getOrganization } from "@/server/repositories/organizations";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { OrganizationEditForm } from "./OrganizationEditForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrganization(id);
  return { title: org ? `${org.legalName} 編集 | RGDシステム` : "企業編集 | RGDシステム" };
}

export default async function OrganizationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, org] = await Promise.all([
    getCurrentUserProfile(),
    getOrganization(id),
  ]);

  if (!org) notFound();
  if (!can(user?.roleCode, PERMISSIONS.CLIENT_EDIT)) notFound();

  return (
    <OrganizationEditForm
      orgId={id}
      initialValues={{
        legalName:       org.legalName,
        corporateNumber: org.corporateNumber,
        postalCode:      org.postalCode,
        address:         org.address,
        industry:        org.industry,
        employeeSize:    org.employeeSize,
        notes:           org.notes,
      }}
    />
  );
}
