/**
 * アカウント発行シート CSV ダウンロード
 *
 * GET /api/cases/[id]/account-sheet
 *
 * 受講者一覧から BOM 付き UTF-8 CSV を生成して返す。
 * 権限: 内部ユーザー（admin / operations_manager / operations_staff）
 */

import { NextResponse } from "next/server";
import { getAuthUser, getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { buildAccountSheetRows, buildAccountSheetCsv } from "@/server/services/application-packages";
import { getCase } from "@/server/repositories/cases";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: caseId } = await params;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const caseData = await getCase(caseId);
  if (!caseData) {
    return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
  }

  const rows = await buildAccountSheetRows(caseId);
  const csv  = buildAccountSheetCsv(rows);

  const safeCode = caseData.caseCode.replace(/[^\w\-]/g, "_");
  const filename = `account_sheet_${safeCode}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
