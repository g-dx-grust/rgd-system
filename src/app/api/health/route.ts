import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const APP_ENV = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";

/**
 * GET /api/health
 * ヘルスチェックエンドポイント
 * Vercel のヘルスチェック・ロードバランサーから使用される
 */
export async function GET() {
  const startedAt = Date.now();

  // Supabase への疎通確認
  let dbStatus: "ok" | "error" = "ok";
  let dbMessage: string | undefined;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // 軽量なクエリで接続確認
    const { error } = await supabase
      .from("roles")
      .select("id")
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") {
      // PGRST116 = 0 rows は正常（テーブルが空の場合）
      dbStatus = "error";
      dbMessage = error.message;
    }
  } catch (err) {
    dbStatus = "error";
    dbMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const latencyMs = Date.now() - startedAt;
  const healthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: APP_VERSION,
      env: APP_ENV,
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: dbStatus, message: dbMessage },
      },
      latency_ms: latencyMs,
    },
    { status: healthy ? 200 : 503 }
  );
}
