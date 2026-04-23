/**
 * Proxy（ルートガード）
 *
 * Next.js 16 では middleware.ts が proxy.ts に改名された。
 * 未認証ユーザーを /login へリダイレクトする楽観的チェックを行う。
 * 重いDB操作は行わず、Supabase の Cookie ベースセッションを確認するのみ。
 * Server Action / Route Handler 内でも必ず権限チェックを行うこと。
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  INTERNAL_LOGIN_PATH,
  SPECIALIST_LOGIN_PATH,
} from "@/lib/auth/access-routes";

/** 認証不要なパス（公開ルート） */
const PUBLIC_PATHS = [
  "/login",
  "/reset-password",
  "/reset-password/confirm",
  "/external/specialist/login",
  "/upload",                    // 顧客向け書類提出画面（トークン認証で保護）
];

/** 認証不要な API パスプレフィックス（トークン認証で保護） */
const PUBLIC_API_PREFIXES = [
  "/api/documents/upload-url",  // トークン認証で保護
  "/api/documents/confirm",     // トークン認証で保護
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開ルートはそのまま通す
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  // Supabase セッション Cookie を確認するためのクライアント
  // proxy では cookies().set が使えないため response を経由して書き込む
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // 環境変数未設定時はログインへ
    if (!isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // セッション確認（トークンリフレッシュも兼ねる）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  // 未認証 → 保護ルートならログインへ
  if (!isPublic && !isAuthenticated) {
    const loginPath = pathname.startsWith("/external/specialist")
      ? SPECIALIST_LOGIN_PATH
      : INTERNAL_LOGIN_PATH;
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 認証済み → 内部ログイン画面にアクセスしたらダッシュボードへ
  // 社労士ロールの最終遷移先は /dashboard レイアウト側で振り分ける
  // （proxy では重いプロフィール参照を避けるためロール判定しない）
  // ただし reason パラメータがある場合はループ防止のためリダイレクトしない
  const reason = request.nextUrl.searchParams.get("reason");
  if (isPublic && isAuthenticated && pathname === "/login" && !reason) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除く全パスに適用:
     * - _next/static（静的ファイル）
     * - _next/image（画像最適化）
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
