/**
 * アカウント発行シート Word (.docx) ダウンロード
 *
 * GET /api/cases/[id]/account-sheet
 *
 * 受講者一覧から .docx を生成して返す。
 * 受講者未登録の場合は 422 を返す。
 * 権限: 内部ユーザー（CASE_EDIT 以上）
 */

import { NextResponse } from "next/server";
import { getAuthUser, getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { buildAccountSheetRows } from "@/server/services/application-packages";
import { buildAccountSheetDocx } from "@/server/usecases/participants/issue-account-sheet";
import { getCase } from "@/server/repositories/cases";
import { writeAuditLog } from "@/server/repositories/audit-log";

function toJstDateLabel(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toYyyyMmDd(date: Date): string {
  return date
    .toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "");
}

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
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "受講者が登録されていません。先に受講者を追加してください。" },
      { status: 422 }
    );
  }

  const now = new Date();
  const docxBuffer = await buildAccountSheetDocx({
    organizationName: caseData.organizationName,
    caseCode:         caseData.caseCode,
    courseName:       caseData.videoCourseName ?? caseData.caseName,
    trainingStart:    caseData.plannedStartDate,
    trainingEnd:      caseData.plannedEndDate,
    issuedDateLabel:  toJstDateLabel(now),
    rows,
  });

  await writeAuditLog({
    userId:     profile?.id ?? null,
    action:     "account_sheet_issue",
    targetType: "case",
    targetId:   caseId,
    metadata:   {
      caseCode:          caseData.caseCode,
      organizationName:  caseData.organizationName,
      participantCount:  rows.length,
    },
  });

  const orgSafe  = caseData.organizationName.replace(/[^\w\u3040-\u9FFF]/g, "_");
  const codeSafe = caseData.caseCode.replace(/[^\w\-]/g, "_");
  const datePart = toYyyyMmDd(now);
  const filenameAscii = `account_sheet_${codeSafe}_${datePart}.docx`;
  const filenameUtf8  = encodeURIComponent(
    `アカウント発行シート_${orgSafe}_${codeSafe}_${datePart}.docx`
  );

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filenameAscii}"; filename*=UTF-8''${filenameUtf8}`,
      "Cache-Control": "no-store",
    },
  });
}
