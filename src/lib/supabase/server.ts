import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバーサイド（Server Component / Route Handler / Server Action）用Supabaseクライアント
 * 環境変数: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase環境変数が設定されていません。.env.localを確認してください。"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server ComponentからsetAllが呼ばれた場合は無視する
          // (Route HandlerやMiddlewareで認証をリフレッシュする)
        }
      },
    },
  });
}
