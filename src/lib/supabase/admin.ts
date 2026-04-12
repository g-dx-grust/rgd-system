import { createClient } from "@supabase/supabase-js";

/**
 * サービスロールクライアント（サーバーサイド限定）
 * RLSをバイパスするため、クライアントコードへの露出は絶対禁止
 *
 * 用途: 管理系マイグレーション / バックグラウンドジョブ / webhook処理
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabaseサービスロールキーが設定されていません。サーバーサイドのみ使用可能です。"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
