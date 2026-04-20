import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { listOperatingCompanies } from "@/server/repositories/operating-companies";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await listOperatingCompanies();
  return NextResponse.json(companies);
}
