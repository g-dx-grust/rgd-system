import type { NextConfig } from "next";

const ENV = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";

const nextConfig: NextConfig = {
  // -------------------------------------------------------
  // セキュリティヘッダー
  // -------------------------------------------------------
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },

  // -------------------------------------------------------
  // 画像最適化（Supabase Storage のドメインを許可）
  // -------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },

  // -------------------------------------------------------
  // 公開環境変数（NEXT_PUBLIC_ プレフィックス必須）
  // サーバーサイド専用の変数は process.env を Server Component / Route Handler で直接参照すること
  // -------------------------------------------------------
  env: {
    NEXT_PUBLIC_APP_ENV: ENV,
  },

  // -------------------------------------------------------
  // ビルド設定
  // -------------------------------------------------------
  output: "standalone",

  // Turbopackの日本語パスバグ回避 (Windows環境)
  // プロジェクトパスに日本語が含まれる場合にTurbopackがpanicするため
  // webpack を使用する (package.json の dev/build スクリプトで --webpack を指定済み)

  // workspace root 誤推定の警告を抑制
  outputFileTracingRoot: process.cwd(),

  // 本番ビルド時に型チェックエラーをビルド失敗にする
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
