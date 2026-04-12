import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ（Client Component）用Supabaseクライアント
 * 環境変数: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase環境変数が設定されていません。.env.localを確認してください。"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
