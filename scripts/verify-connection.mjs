/**
 * Supabase 接続確認スクリプト
 * 使用: node scripts/verify-connection.mjs [access-token]
 *
 * access-token なし: PostgREST 経由（RLS が適用される）
 * access-token あり: Management API 経由（RLS バイパス・正確な確認）
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = "wgakklsryzzfeviuccdv";
const ACCESS_TOKEN = process.argv[2];

console.log("==============================================");
console.log("RGDシステム — Supabase 接続確認");
console.log(`URL: ${SUPABASE_URL}`);
console.log("==============================================\n");

async function queryViaManagementAPI(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function checkTableViaAPI(tableName) {
  try {
    const rows = await queryViaManagementAPI(
      `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${tableName}'`
    );
    return { exists: rows[0]?.count === "1" || Number(rows[0]?.count) === 1 };
  } catch (e) {
    return { exists: false, error: e.message };
  }
}

async function checkTableViaClient(tableName) {
  const supabase = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.from(tableName).select("*").limit(1);
  if (error?.code === "42P01") return { exists: false, error: "テーブル未存在" };
  if (error) return { exists: false, error: error.message };
  return { exists: true };
}

const tables = ["roles", "user_profiles", "audit_logs"];
let allOk = true;

if (ACCESS_TOKEN) {
  // Management API 経由（RLS バイパス・正確）
  for (const table of tables) {
    const result = await checkTableViaAPI(table);
    if (result.exists || result.exists === undefined) {
      console.log(`✅ ${table}: テーブル存在確認OK`);
    } else {
      console.log(`❌ ${table}: ${result.error || "未存在"}`);
      allOk = false;
    }
  }

  // roles データ確認
  const roles = await queryViaManagementAPI(
    "SELECT code, label_ja, sort_order FROM roles ORDER BY sort_order"
  );
  if (roles.length > 0) {
    console.log(`\n✅ roles データ確認 (${roles.length} 件):`);
    roles.forEach((r) => console.log(`   - ${r.code}: ${r.label_ja}`));
  } else {
    console.log("\n❌ roles テーブルにデータなし");
    allOk = false;
  }
} else {
  // JS クライアント経由（RLS が適用される）
  console.log("⚠️  access-token なし — PostgREST経由で確認（RLS適用）\n");
  for (const table of tables) {
    const result = await checkTableViaClient(table);
    if (result.exists) {
      console.log(`✅ ${table}: 接続・テーブルOK（RLS適用済み）`);
    } else {
      console.log(`❌ ${table}: ${result.error}`);
      allOk = false;
    }
  }
}

// service_role キーの検証
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svcKey = env.SUPABASE_SERVICE_ROLE_KEY;
console.log("");
if (anonKey === svcKey) {
  console.log(
    "⚠️  警告: SUPABASE_SERVICE_ROLE_KEY が ANON_KEY と同一です。"
  );
  console.log(
    "   → Supabase ダッシュボード > Settings > API から正しいサービスロールキーを取得して .env.local を更新してください。"
  );
  allOk = false;
} else {
  console.log("✅ service_role キーと anon キーが別々に設定されています");
}

console.log("\n==============================================");
if (allOk) {
  console.log("✅ 全チェック通過 — Supabase 接続・スキーマ正常");
} else {
  console.log("⚠️  一部確認事項があります（上記参照）");
}
console.log("==============================================");
