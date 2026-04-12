/**
 * Supabase リモートDBに seed データを適用するスクリプト
 * ============================================================
 * 使用方法:
 *   node scripts/apply-seed.mjs <access-token> [--file 01_roles.sql]
 *
 * オプション:
 *   --file <filename>  特定のseedファイルだけ適用（省略時は全ファイルを順番に適用）
 *
 * アクセストークンの取得:
 *   https://app.supabase.com/account/tokens
 * ============================================================
 */
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "wgakklsryzzfeviuccdv";
const ACCESS_TOKEN = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("使用方法: node scripts/apply-seed.mjs <access-token> [--file <filename>]");
  console.error("トークン取得: https://app.supabase.com/account/tokens");
  process.exit(1);
}

// --file オプション解析
const fileArgIdx = process.argv.indexOf("--file");
const targetFile = fileArgIdx !== -1 ? process.argv[fileArgIdx + 1] : null;

const seedDir = resolve(__dirname, "../supabase/seed");

// 適用対象ファイルを決定
let seedFiles;
if (targetFile) {
  seedFiles = [targetFile];
} else {
  seedFiles = readdirSync(seedDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // ファイル名の番号順に適用
}

console.log("==============================================");
console.log("RGDシステム — seed データ適用");
console.log(`Project: ${PROJECT_REF}`);
console.log(`適用ファイル: ${seedFiles.join(", ")}`);
console.log("==============================================\n");

async function applySeed(filename) {
  const filePath = resolve(seedDir, filename);
  let sql;
  try {
    sql = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`❌ ファイルが見つかりません: ${filename}`);
    return false;
  }

  console.log(`📄 ${filename} を適用中...`);

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

  if (!response.ok) {
    const body = await response.text();
    console.error(`❌ ${filename} 適用失敗 (HTTP ${response.status}):`, body);
    return false;
  }

  console.log(`✅ ${filename} 適用成功`);
  return true;
}

let allOk = true;
for (const file of seedFiles) {
  const ok = await applySeed(file);
  if (!ok) {
    allOk = false;
    if (targetFile) break;
  }
}

console.log("\n==============================================");
if (allOk) {
  console.log(`✅ 全seed適用完了 (${seedFiles.length} ファイル)`);
} else {
  console.log("⚠️  一部の seed 適用に失敗しました（上記ログを確認してください）");
  process.exit(1);
}
console.log("==============================================");
