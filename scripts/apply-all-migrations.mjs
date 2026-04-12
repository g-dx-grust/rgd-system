/**
 * Supabase リモートDBに未適用のマイグレーションをすべて順番に適用するスクリプト
 *
 * 使用方法:
 *   node scripts/apply-all-migrations.mjs <supabase-access-token>
 *
 * アクセストークンの取得:
 *   https://app.supabase.com/account/tokens
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "wgakklsryzzfeviuccdv";
const ACCESS_TOKEN = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("使用方法: node scripts/apply-all-migrations.mjs <access-token>");
  console.error("トークン取得: https://app.supabase.com/account/tokens");
  process.exit(1);
}

// 適用するマイグレーションファイル（順番厳守）
// ※ 20260412000002_step03_organizations_cases_participants.sql は重複のためスキップ
const MIGRATIONS = [
  "20260412000002_step03_master_cases.sql",
  "20260412000003_step04_document_management.sql",
  "20260412000004_step05_application_packages.sql",
  "20260412000005_step06_post_acceptance.sql",
  "20260412000006_step07_lms_progress.sql",
  "20260412000006_step08_completion_final_application.sql",
  "20260412000007_step09_ops_hardening.sql",
  "20260412000008_step10_go_live.sql",
  "20260412000009_a2_document_access_control.sql",
  "20260412000009_add_upload_token_id_to_documents.sql",
  "20260412000010_c1_checklist_document_templates.sql",
];

async function runQuery(sql) {
  const response = await fetch(
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

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return body;
}

console.log("==============================================");
console.log("RGDシステム — 全マイグレーション適用");
console.log(`Project: ${PROJECT_REF}`);
console.log(`対象ファイル数: ${MIGRATIONS.length}`);
console.log("==============================================\n");

let successCount = 0;
let failCount = 0;

for (const filename of MIGRATIONS) {
  const filepath = resolve(__dirname, "../supabase/migrations", filename);
  process.stdout.write(`[${successCount + failCount + 1}/${MIGRATIONS.length}] ${filename} ... `);

  let sql;
  try {
    sql = readFileSync(filepath, "utf-8");
  } catch {
    console.log("❌ ファイルが見つかりません");
    failCount++;
    continue;
  }

  try {
    await runQuery(sql);
    console.log("✅ 成功");
    successCount++;
  } catch (err) {
    console.log("❌ 失敗");
    console.error(`   エラー: ${err.message}\n`);
    failCount++;

    // エラーが出ても続行するか確認
    console.error("   ⚠️  このファイルでエラーが発生しました。以降のマイグレーションは依存関係があるため中断します。");
    console.error("   エラー内容を確認して修正してから再実行してください。\n");
    break;
  }
}

console.log("\n==============================================");
console.log(`結果: 成功 ${successCount} / 失敗 ${failCount} / 合計 ${MIGRATIONS.length}`);
console.log("==============================================");

if (failCount > 0) {
  process.exit(1);
}
