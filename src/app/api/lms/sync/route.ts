/**
 * POST /api/lms/sync
 *
 * LMS進捗 CSV 取込エンドポイント（multipart/form-data）。
 * Server Action と同等の処理を Route Handler として提供する。
 * 主に外部スクリプト / バッチ連携用途を想定する。
 *
 * Body (FormData):
 *   caseId:   string
 *   csvFile:  File (.csv)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { syncLmsProgressAction } from "@/server/usecases/lms/sync-actions";

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.LMS_PROGRESS_SYNC)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const result = await syncLmsProgressAction(null, formData);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    syncLogId:      result.syncLogId,
    totalRecords:   result.totalRecords,
    successRecords: result.successRecords,
    errorRecords:   result.errorRecords,
    errors:         result.errors ?? [],
  });
}
