/**
 * Supabase リモートDBにマイグレーションを適用するスクリプト
 * 使用: node scripts/apply-migration.mjs <supabase-access-token>
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
  console.error("使用方法: node scripts/apply-migration.mjs <access-token>");
  console.error("トークン取得: https://app.supabase.com/account/tokens");
  process.exit(1);
}

const migrationPath = resolve(
  __dirname,
  "../supabase/migrations/20260412000000_init_roles_users.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

console.log("==============================================");
console.log("RGDシステム — マイグレーション適用");
console.log(`Project: ${PROJECT_REF}`);
console.log("==============================================\n");

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
  console.error(`❌ マイグレーション適用失敗 (HTTP ${response.status}):`, body);
  process.exit(1);
}

const result = await response.json();
console.log("✅ マイグレーション適用成功");
console.log("結果:", JSON.stringify(result, null, 2));
