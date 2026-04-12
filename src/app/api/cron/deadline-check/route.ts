import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/cron/deadline-check
 * 日次期限監視ジョブ（毎朝9時 JST に Vercel Cron から呼び出される）
 *
 * 対象:
 * - document_requirements.due_date が翌日以内 かつ未承認
 * - cases.pre_application_due_date / final_application_due_date が翌週以内
 *
 * 結果を notifications テーブルへ書き込む（同日重複は除外）
 */

const TERMINAL_STATUSES = ["completed", "cancelled"] as const;

export async function GET(req: NextRequest) {
  // CRON_SECRET ヘッダーで認証
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 日付計算（JST 基準で比較するが DATE 型は文字列比較で問題なし）
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const todayStr = toDateStr(now);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toDateStr(tomorrowDate);

  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekStr = toDateStr(nextWeekDate);

  type NotificationInsert = {
    user_id: string;
    title: string;
    body: string;
    link_url: string | null;
    category: string;
    case_id: string | null;
  };

  const toInsert: NotificationInsert[] = [];
  let docReqCount = 0;
  let preAppCount = 0;
  let finalAppCount = 0;

  // ------------------------------------------------------------------
  // 1. document_requirements の期限（翌日以内・未承認）
  // ------------------------------------------------------------------
  const { data: docReqs, error: docReqErr } = await supabase
    .from("document_requirements")
    .select("case_id, due_date, status")
    .lte("due_date", tomorrowStr)
    .gte("due_date", todayStr)
    .neq("status", "approved");

  if (docReqErr) {
    console.error("[deadline-check] document_requirements query failed:", docReqErr.message);
  } else if (docReqs && docReqs.length > 0) {
    // case_id ごとに件数を集計
    const countByCaseId = new Map<string, number>();
    for (const row of docReqs) {
      countByCaseId.set(row.case_id, (countByCaseId.get(row.case_id) ?? 0) + 1);
    }

    const caseIds = [...countByCaseId.keys()];

    const { data: docReqCases } = await supabase
      .from("cases")
      .select("id, name, owner_user_id")
      .in("id", caseIds)
      .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
      .is("deleted_at", null)
      .not("owner_user_id", "is", null);

    for (const c of docReqCases ?? []) {
      const count = countByCaseId.get(c.id) ?? 0;
      toInsert.push({
        user_id: c.owner_user_id as string,
        title: "書類提出期限が迫っています",
        body: `案件「${c.name}」で ${count} 件の書類提出期限が翌日以内です。`,
        link_url: `/cases/${c.id}/documents`,
        category: "warning",
        case_id: c.id,
      });
      docReqCount++;
    }
  }

  // ------------------------------------------------------------------
  // 2. cases.pre_application_due_date が翌週以内
  // ------------------------------------------------------------------
  const { data: preAppCases, error: preAppErr } = await supabase
    .from("cases")
    .select("id, name, owner_user_id, pre_application_due_date")
    .lte("pre_application_due_date", nextWeekStr)
    .gte("pre_application_due_date", todayStr)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .is("deleted_at", null)
    .not("owner_user_id", "is", null);

  if (preAppErr) {
    console.error("[deadline-check] pre_application_due_date query failed:", preAppErr.message);
  }

  for (const c of preAppCases ?? []) {
    toInsert.push({
      user_id: c.owner_user_id as string,
      title: "初回申請期限が迫っています",
      body: `案件「${c.name}」の初回申請期限（${c.pre_application_due_date as string}）が1週間以内です。`,
      link_url: `/cases/${c.id}`,
      category: "warning",
      case_id: c.id,
    });
    preAppCount++;
  }

  // ------------------------------------------------------------------
  // 3. cases.final_application_due_date が翌週以内
  // ------------------------------------------------------------------
  const { data: finalAppCases, error: finalAppErr } = await supabase
    .from("cases")
    .select("id, name, owner_user_id, final_application_due_date")
    .lte("final_application_due_date", nextWeekStr)
    .gte("final_application_due_date", todayStr)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .is("deleted_at", null)
    .not("owner_user_id", "is", null);

  if (finalAppErr) {
    console.error("[deadline-check] final_application_due_date query failed:", finalAppErr.message);
  }

  for (const c of finalAppCases ?? []) {
    toInsert.push({
      user_id: c.owner_user_id as string,
      title: "最終申請期限が迫っています",
      body: `案件「${c.name}」の最終申請期限（${c.final_application_due_date as string}）が1週間以内です。`,
      link_url: `/cases/${c.id}`,
      category: "warning",
      case_id: c.id,
    });
    finalAppCount++;
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      message: "期限が迫っている案件・書類はありませんでした。",
    });
  }

  // ------------------------------------------------------------------
  // 同日重複除外: 今日すでに作成した同 case_id × category の通知を除く
  // ------------------------------------------------------------------
  const targetCaseIds = [...new Set(toInsert.map((n) => n.case_id).filter(Boolean))];

  const { data: existingToday } = await supabase
    .from("notifications")
    .select("case_id, title")
    .in("case_id", targetCaseIds as string[])
    .gte("created_at", `${todayStr}T00:00:00+09:00`)
    .lt("created_at", `${tomorrowStr}T00:00:00+09:00`);

  const existingSet = new Set(
    (existingToday ?? []).map((n) => `${n.case_id}::${n.title}`)
  );

  const deduped = toInsert.filter(
    (n) => !existingSet.has(`${n.case_id}::${n.title}`)
  );

  if (deduped.length === 0) {
    return NextResponse.json({
      ok: true,
      inserted: 0,
      message: "本日分の通知はすでに作成済みです。",
    });
  }

  const { error: insertErr } = await supabase
    .from("notifications")
    .insert(deduped);

  if (insertErr) {
    console.error("[deadline-check] notifications insert failed:", insertErr.message);
    return NextResponse.json(
      { error: "通知の書き込みに失敗しました。", detail: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    inserted: deduped.length,
    summary: {
      document_requirements: docReqCount,
      pre_application: preAppCount,
      final_application: finalAppCount,
    },
  });
}
