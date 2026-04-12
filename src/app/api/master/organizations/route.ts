import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { listOrganizations } from "@/server/repositories/organizations";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizations = await listOrganizations();
  return NextResponse.json(
    organizations.map((o) => ({ id: o.id, legalName: o.legalName }))
  );
}
