/**
 * 管理者ユーザー初期登録スクリプト
 * ============================================================
 * 使用方法:
 *   npx tsx scripts/seed-admin-users.ts
 *
 * 前提:
 *   - .env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定済み
 *   - supabase/seed/06_admin_users.sql が存在する（追記用）
 *
 * 実行後:
 *   各ユーザーの仮パスワードを標準出力に表示します。
 *   安全な場所に控え、初回ログイン後に必ず変更してください。
 * ============================================================
 * 環境変数:
 *   ADMIN_TEMP_PASSWORD  共通仮パスワードを指定（省略時はユーザーごとにランダム生成）
 * ============================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local を手動パース
function loadEnv(path: string) {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ファイルが存在しない場合は無視
  }
}
loadEnv(resolve(__dirname, "../.env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("環境変数が設定されていません。.env.local を確認してください。");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----------------------------------------------------------------
// パスワード生成ユーティリティ
// ----------------------------------------------------------------

/** ランダムな強パスワードを生成（英大小文字 + 数字 + 記号 / 20文字） */
function generateSecurePassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;

  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);

  let password = "";
  // 各カテゴリから最低1文字確保
  password += upper[randomBytes[0] % upper.length];
  password += lower[randomBytes[1] % lower.length];
  password += digits[randomBytes[2] % digits.length];
  password += special[randomBytes[3] % special.length];

  for (let i = 4; i < 20; i++) {
    password += all[randomBytes[i] % all.length];
  }

  // シャッフル（Fisher-Yates）
  const chars = password.split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes[i % randomBytes.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** 環境変数またはランダム生成でパスワードを取得 */
function resolveTempPassword(): string | null {
  return process.env.ADMIN_TEMP_PASSWORD ?? null;
}

// ----------------------------------------------------------------
// 登録するユーザー定義
// ----------------------------------------------------------------

const USERS = [
  {
    email: "k-suzuki@aim-ai.jp",
    displayName: "鈴木",
    roleCode: "admin",
  },
  {
    email: "shoji@n-grust.co.jp",
    displayName: "庄司",
    roleCode: "admin",
  },
  {
    email: "k-sugaya@aim-ai.jp",
    displayName: "菅谷",
    roleCode: "admin",
  },
  {
    email: "suga@aim-ai.jp",
    displayName: "菅",
    roleCode: "admin",
  },
] as const;

// ----------------------------------------------------------------
// メイン処理
// ----------------------------------------------------------------
async function main() {
  console.log("=== 管理者ユーザー初期登録 ===\n");

  const sharedPassword = resolveTempPassword();
  if (sharedPassword) {
    console.log("共通仮パスワード (ADMIN_TEMP_PASSWORD) を使用します。\n");
  } else {
    console.log("ADMIN_TEMP_PASSWORD が未設定のため、ユーザーごとにランダムパスワードを生成します。\n");
  }

  // admin ロールの ID を取得
  const { data: roleData, error: roleError } = await supabase
    .from("roles")
    .select("id, code")
    .eq("code", "admin")
    .single();

  if (roleError || !roleData) {
    console.error("admin ロールが見つかりません。マイグレーションが適用されているか確認してください。");
    console.error(roleError?.message);
    process.exit(1);
  }

  const adminRoleId = roleData.id;
  console.log(`admin role_id: ${adminRoleId}\n`);

  const createdUsers: Array<{ email: string; password: string }> = [];

  for (const user of USERS) {
    process.stdout.write(`[${user.email}] 作成中... `);

    const tempPassword = sharedPassword ?? generateSecurePassword();

    // Auth ユーザー作成（既存の場合はスキップ）
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: user.displayName },
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        console.log("⚠ 既存ユーザー（スキップ）");
      } else {
        console.log(`✗ 失敗: ${error.message}`);
      }
      continue;
    }

    const userId = data.user.id;

    // user_profiles の role を admin に更新
    // （trigger が operations_staff で作成するため上書きする）
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          role_id: adminRoleId,
          display_name: user.displayName,
          email: user.email,
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.log(`✗ プロフィール更新失敗: ${profileError.message}`);
      continue;
    }

    console.log(`✓ 完了 (id: ${userId})`);
    createdUsers.push({ email: user.email, password: tempPassword });
  }

  console.log("\n=== 登録完了 ===");
  if (createdUsers.length > 0) {
    console.log("\n--- 仮パスワード一覧（初回ログイン後に必ず変更してください） ---");
    for (const u of createdUsers) {
      console.log(`  ${u.email}  →  ${u.password}`);
    }
    console.log("----------------------------------------------------------------");
  }
}

main().catch((err) => {
  console.error("予期しないエラー:", err);
  process.exit(1);
});
