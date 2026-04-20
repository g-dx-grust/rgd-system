# RGDシステム

助成金を用いた企業研修案件の受領から完了までの事務運用を一元管理するシステムです。

---

## 開発環境のセットアップ

### 必要なもの

| ツール | バージョン | インストール先 |
|---|---|---|
| **Node.js** | v20 以上 | https://nodejs.org/ja （LTS 推奨） |
| **npm** | v10 以上（Node に同梱） | — |
| **Git** | 最新版 | https://git-scm.com |

> **Windows の場合**: Node.js の公式インストーラー（`.msi`）を使うのが最も簡単です。

---

### 手順

#### 1. リポジトリをクローン

```bash
git clone https://github.com/<org>/rgd-system.git
cd rgd-system
```

#### 2. パッケージをインストール

```bash
npm install
```

#### 3. 環境変数を設定

```bash
cp .env.example .env.local
```

`.env.local` を開き、以下の値を設定してください。  
値は管理者（グラスト社内）に確認してください。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### 4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと動作確認できます。

---

## よく使うコマンド

```bash
npm run dev        # 開発サーバー起動（ホットリロード付き）
npm run typecheck  # TypeScript 型チェック
npm run lint       # ESLint チェック
npm run lint:fix   # ESLint 自動修正
npm test           # ユニットテスト実行
```

---

## ディレクトリ構成（抜粋）

```
src/
├── app/                  # Next.js App Router（ページ）
│   ├── (auth)/           # ログイン画面
│   ├── (dashboard)/      # 業務画面（案件・企業・書類 etc.）
│   └── api/              # Route Handlers
├── components/           # UIコンポーネント
├── server/
│   ├── repositories/     # DBアクセス
│   ├── services/         # 業務ロジック
│   └── usecases/         # Server Actions
├── lib/                  # ユーティリティ・定数
└── types/                # 型定義
supabase/
├── migrations/           # DBマイグレーション
└── seed/                 # 初期データ
```

---

## 技術スタック

- **フレームワーク**: Next.js (App Router) + TypeScript
- **UI**: Tailwind CSS
- **認証・DB・Storage**: Supabase
- **デプロイ**: Vercel

---

## 注意事項

- `.env.local` はコミットしないでください（`.gitignore` 対象）
- `main` ブランチへの直接プッシュは避け、PR 経由でマージしてください
- 詳細な実装ルールは [`CLAUDE.md`](../CLAUDE.md) を参照してください
