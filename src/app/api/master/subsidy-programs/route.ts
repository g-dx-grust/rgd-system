import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { listSubsidyPrograms } from "@/server/repositories/subsidy-programs";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const programs = await listSubsidyPrograms(true);
  return NextResponse.json(
    programs.map((p) => ({ id: p.id, name: p.name }))
  );
}
