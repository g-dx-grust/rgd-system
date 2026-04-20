/**
 * Supabase management API 経由で SQL ファイルを手動実行するスクリプト
 *
 * 注意:
 * - このスクリプトは schema_migrations を更新しません。
 * - 通常の migration 適用は `npm run db:migrate` を使用してください。
 *
 * 使用:
 *   node scripts/apply-migration.mjs <supabase-access-token> <migration-file|--all>
 *
 * アクセストークンの取得:
 *   https://app.supabase.com/account/tokens
 */
import { readdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "wgakklsryzzfeviuccdv";
const ACCESS_TOKEN = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
const TARGET = process.argv[3] || "--all";

if (!ACCESS_TOKEN) {
  console.error(
    "使用方法: node scripts/apply-migration.mjs <access-token> <migration-file|--all>"
  );
  console.error("トークン取得: https://app.supabase.com/account/tokens");
  process.exit(1);
}

function getMigrationFiles() {
  const migrationsDir = resolve(__dirname, "../supabase/migrations");
  const allFiles = readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  if (TARGET !== "--all") {
    return [resolve(migrationsDir, TARGET)];
  }

  return allFiles.map((file) => resolve(migrationsDir, file));
}

console.log("==============================================");
console.log("RGDシステム — 手動SQL適用");
console.log(`Project: ${PROJECT_REF}`);
console.log("==============================================\n");

console.log("! 通常の migration 適用は `npm run db:migrate` を使用してください。");
console.log("! このスクリプトは schema_migrations を更新しません。\n");

for (const migrationPath of getMigrationFiles()) {
  const sql = readFileSync(migrationPath, "utf-8");

  console.log(`→ 実行中: ${migrationPath}`);

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
    console.error(`❌ SQL適用失敗 (HTTP ${response.status}):`, body);
    process.exit(1);
  }

  const result = await response.json();
  console.log("✅ 実行成功");
  console.log("結果:", JSON.stringify(result, null, 2));
  console.log("");
}
