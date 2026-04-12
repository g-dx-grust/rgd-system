# RGDシステム — Codexレビュー対応 修正指示書

作成日: 2026-04-12
対象: rgd-system

---

## 全体構成

修正を **フェーズ A〜D** に分類。同フェーズ内のタスクは **並行実施可**。
フェーズ間には依存関係があり、**A → B → C → D** の順で進める。

```
フェーズA（基盤修正）  ── 並行可: A-1, A-2, A-3, A-4
        ↓
フェーズB（機能修正）  ── 並行可: B-1, B-2, B-3, B-4
        ↓
フェーズC（機能追加）  ── 並行可: C-1, C-2, C-3
        ↓
フェーズD（品質・運用） ── 並行可: D-1, D-2, D-3
```

---

## フェーズA: 基盤修正（セキュリティ・DB不整合）

> フェーズBの機能修正はここで作った基盤の上に乗るため、先に完了させる。
> A-1〜A-4 は互いに独立なので **並行実施可**。

### A-1: 顧客向けアップロード導線の修復 [重大]

**問題**: 外部提出画面 `/upload/[token]` が存在せず、proxy.ts で未認証アクセスが `/login` へリダイレクトされる。さらに `upload-url/route.ts` は内部認証必須、`confirm/route.ts` が `token:...` を `uploaded_by_user_id`（UUID FK）に渡すため DB 制約違反で保存不可。

**修正内容**:

1. **proxy.ts** — 公開パスに `/upload` と `/api/documents/upload-url`、`/api/documents/confirm` を追加
   ```ts
   // src/proxy.ts:15
   const PUBLIC_PATHS = [
     "/login",
     "/reset-password",
     "/reset-password/confirm",
     "/upload",                    // 追加
   ];

   // API パスは prefix マッチで公開
   const PUBLIC_API_PREFIXES = [
     "/api/documents/upload-url",  // 追加（トークン認証で保護）
     "/api/documents/confirm",     // 追加（トークン認証で保護）
   ];
   ```
   `proxy` 関数内で `pathname` が `PUBLIC_API_PREFIXES` のいずれかに前方一致する場合も `isPublic = true` とする。

2. **upload-url/route.ts** — トークン認証の分岐を追加
   - リクエストボディに `uploadToken` が含まれる場合は `getAuthUser()` を呼ばず、`upload_tokens` テーブルでトークンを検証する
   - トークンの `case_id` / `organization_id` と リクエストの `caseId` / `organizationId` の一致を確認
   - トークンの `expires_at` と `is_active` を検証

3. **confirm/route.ts:70** — `uploaded_by_user_id` の FK 制約違反を修正
   - `token:xxx` を UUID 列に入れるのではなく、`uploaded_by_user_id` を `NULL` にする
   - 代わりに `upload_token_id`（UUID）列を documents テーブルに追加し、トークン経由のアップロード元を記録する
   - migration ファイルを新規追加:
     ```sql
     ALTER TABLE documents ADD COLUMN upload_token_id UUID REFERENCES upload_tokens(id) ON DELETE SET NULL;
     CREATE INDEX idx_documents_upload_token_id ON documents (upload_token_id);
     ```

4. **外部提出画面の作成** — `src/app/(external)/upload/[token]/page.tsx`
   - Server Component でトークンを検証（期限切れ・無効化チェック）
   - 有効なら案件情報・必要書類一覧を表示
   - Client Component のアップロードフォームで `upload-url` → Storage直接アップロード → `confirm` の流れを実装
   - proxy.ts で `(external)` 配下は認証不要とする（上記 PUBLIC_PATHS で対応済み）

**対象ファイル**:
- `src/proxy.ts`
- `src/app/api/documents/upload-url/route.ts`
- `src/app/api/documents/confirm/route.ts`
- `src/server/repositories/documents.ts` （registerDocument の引数にupload_token_id を追加）
- `supabase/migrations/` に新規 migration
- `src/app/(external)/upload/[token]/page.tsx` （新規）
- `src/app/(external)/upload/[token]/UploadForm.tsx` （新規 Client Component）

---

### A-2: 書類閲覧の案件単位権限チェック [重大]

**問題**: `signed-url/route.ts` はログイン済みかのみ確認。RLS の `documents_select_internal` も社内ユーザー全体を許可。document ID さえ分かれば他案件のファイルに到達可能。

**修正内容**:

1. **signed-url/route.ts** — 案件単位の権限チェックを追加
   ```ts
   // document 取得後、ユーザーのロールに応じたチェック
   const profile = await getCurrentUserProfile();
   if (!profile) return 401;

   // Client Portal User → 自組織の案件のみ
   if (profile.roleCode === 'client_portal_user') {
     if (document.organizationId !== profile.organizationId) return 403;
   }
   // External Specialist → 共有パッケージ経由のみ（Step5以降で実装、現時点では拒否）
   if (profile.roleCode === 'external_specialist') return 403;
   // 内部ユーザー → 案件アクセス権チェック（現時点では全案件許可、将来的に担当案件制限を検討）
   ```

2. **RLS ポリシー `documents_select_internal`** — 現時点は内部ユーザー全許可で運用上問題ないが、Client Portal User 向けのポリシーを追加
   ```sql
   CREATE POLICY documents_select_client ON documents
     FOR SELECT TO authenticated
     USING (
       deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM user_profiles up
         JOIN roles r ON r.id = up.role_id
         WHERE up.id = auth.uid()
           AND r.code = 'client_portal_user'
           AND up.organization_id = documents.organization_id
           AND up.deleted_at IS NULL
       )
     );
   ```

3. 監査ログ: 署名付きURL発行時にも `writeAuditLog` を呼ぶ（action: `document_view`）

**対象ファイル**:
- `src/app/api/documents/[id]/signed-url/route.ts`
- `supabase/migrations/` に新規 migration（RLS ポリシー追加）

---

### A-3: bulk API の `is_auto_generated` スキーマ不整合修正 [中]

**問題**: `cases/bulk/route.ts:103` が `tasks` テーブルに `is_auto_generated` 列を insert しているが、migration の `tasks` テーブルにこの列は存在しない（`generated_by_rule TEXT` が代替的に存在）。

**修正内容**:

`src/app/api/cases/bulk/route.ts:95-106` の insert オブジェクトを修正:
```ts
const tasks = caseIds.map((caseId) => ({
  case_id:           caseId,
  title:             "不備再依頼の確認",
  description:       returnReason ?? "書類不備の再依頼が発生しました。確認・対応してください。",
  status:            "open",
  priority:          "high",
  assignee_user_id:  null as string | null,
  due_date:          null as string | null,
  generated_by_rule: "bulk_return_task",  // is_auto_generated → generated_by_rule に変更
  created_at:        now,
  updated_at:        now,
}));
```

**対象ファイル**:
- `src/app/api/cases/bulk/route.ts`

---

### A-4: lint エラー修正 [中]

**問題**: `npm run lint` が失敗する。主要エラーは以下の通り。

- `DocumentPreview.tsx:27` — `react-hooks/set-state-in-effect`: useEffect 本体内で `setLoading(true)` / `setError(null)` を同期的に呼んでおり、カスケードレンダーの原因になる
- `import-cases.ts:162` — `@typescript-eslint/no-unused-vars`: `validateRow` の引数 `rowNum` が未使用
- `import-cases.ts:217` — 不要な `eslint-disable` ディレクティブ（実際にはエラーが報告されていない行）
- `import-cases.ts:219` — `@typescript-eslint/no-explicit-any`: `.map((s: any) => ...)` の `any`

**修正内容**:

1. **DocumentPreview.tsx** — useEffect 内の同期的 `setState` を排除する。fetch 開始前の状態リセットは effect の外で行う設計に変更。

   方針: `documentId` が変わったタイミングの状態リセットには `key` プロパティを使うか、fetch のコールバック内でのみ setState する構造にリファクタする。
   ```tsx
   // 修正例: effect 内の同期 setState を除去し、fetch コールバック内に限定
   useEffect(() => {
     let cancelled = false;
     const controller = new AbortController();

     fetch(`/api/documents/${documentId}/signed-url`, { signal: controller.signal })
       .then(async (res) => {
         if (!res.ok) {
           const { error: msg } = await res.json() as { error: string };
           throw new Error(msg);
         }
         return res.json() as Promise<{ signedUrl: string }>;
       })
       .then(({ signedUrl }) => {
         if (!cancelled) {
           setSignedUrl(signedUrl);
           setError(null);
           setLoading(false);
         }
       })
       .catch((err: Error) => {
         if (!cancelled) {
           setError(err.message);
           setLoading(false);
         }
       });

     return () => {
       cancelled = true;
       controller.abort();
     };
   }, [documentId]);
   ```
   初期値 `loading: true` は `useState` の初期値で担保する。`documentId` が変わるケースは親コンポーネント側で `key={documentId}` を付けてマウントし直すのが最もシンプル。

2. **import-cases.ts:162** — `validateRow` の引数 `rowNum` を削除（関数内で使われていない）
   ```ts
   // Before
   function validateRow(row: CsvRow, rowNum: number): { ... }
   // After
   function validateRow(row: CsvRow): { ... }
   ```
   呼び出し側 `validateRow(row, rowNum)` → `validateRow(row)` に変更。

3. **import-cases.ts:217** — 不要な `eslint-disable` ディレクティブを削除

4. **import-cases.ts:219** — `any` を具体的な型に置換
   ```ts
   // Before
   (subsidyPrograms ?? []).map((s: any) => [s.code as string, s.id as string])
   // After
   (subsidyPrograms ?? []).map((s: { code: string; id: string }) => [s.code, s.id])
   ```

**対象ファイル**:
- `src/components/domain/documents/DocumentPreview.tsx`
- `scripts/import-cases.ts`

---

## フェーズB: 機能修正（導線・UX）

> フェーズA で基盤が整った後に着手。B-1〜B-4 は互いに独立なので **並行実施可**。

### B-1: 404になるサイドバー導線を修復 [高]

**問題**: サイドバーが `/participants` `/documents` `/billing` `/settings` `/notifications` へリンクしているが、これらのページが存在しない。案件詳細の `/cases/[id]/edit` も同様。

**修正内容**:

**方針**: 今すぐ全ページを実装するのは現実的でない。以下の2段階で対応。

#### 段階1（即時対応）: 存在しないページには暫定ページを作成

以下に最低限の「準備中」ページを作成（Server Component、レイアウト準拠）:

| パス | ファイル |
|---|---|
| `/participants` | `src/app/(dashboard)/participants/page.tsx` |
| `/documents` | `src/app/(dashboard)/documents/page.tsx` |
| `/billing` | `src/app/(dashboard)/billing/page.tsx` |
| `/settings` | `src/app/(dashboard)/settings/page.tsx` |
| `/notifications` | `src/app/(dashboard)/notifications/page.tsx` |
| `/cases/[id]/edit` | `src/app/(dashboard)/cases/[id]/edit/page.tsx` |

各ページの共通パターン:
```tsx
export const metadata = { title: "○○ | RGDシステム" };
export default function XxxPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">○○</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        この機能は現在準備中です。
      </p>
    </div>
  );
}
```

#### 段階2: `/cases/[id]/edit` を本実装

- 案件詳細画面の「編集」ボタン先として、案件フォーム（CaseForm）を実装
- Server Component で案件データをフェッチ → Client Component のフォームに渡す
- Server Action で更新処理 + 監査ログ

**案件詳細のサブタブページも未存在**: `/cases/[id]/applications`, `/cases/[id]/billing`, `/cases/[id]/evidence`, `/cases/[id]/messages` — これらも段階1と同様に暫定ページを作成。

**対象ファイル**:
- 上記テーブルの各 `page.tsx`（新規作成）

---

### B-2: ダッシュボード → 案件一覧のフィルタ導線修正 [中]

**問題**: ダッシュボードが `?view=active|overdue|stalled|stuck` を付けるが、案件一覧ページは `view` パラメータを無視する。

**修正内容**:

1. **cases/page.tsx** — `view` パラメータの読み取りと変換ロジックを追加
   ```ts
   const view = sp["view"] || undefined;

   // view → status / 特殊フィルタ への変換
   let statusFilter = status;
   let overdueOnly = false;
   let stalledOnly = false;

   if (view === "active") {
     // completed, cancelled, on_hold 以外
     statusFilter = undefined; // listCases に excludeStatuses オプション追加
   } else if (view === "overdue") {
     overdueOnly = true;
   } else if (view === "stalled" || view === "stuck") {
     stalledOnly = true;
   }
   ```

2. **listCases リポジトリ** — `overdueOnly` / `stalledOnly` / `excludeStatuses` オプションを追加
   - `overdueOnly`: `pre_application_due_date < NOW() OR final_application_due_date < NOW()` かつ未完了
   - `stalledOnly`: `updated_at < NOW() - INTERVAL '7 days'` かつ未完了
   - `excludeStatuses`: 指定ステータスを除外

3. **CaseFilterBar.tsx** — 現在の `view` パラメータを表示に反映（アクティブビュー名を表示）

**対象ファイル**:
- `src/app/(dashboard)/cases/page.tsx`
- `src/server/repositories/cases.ts`（listCases に引数追加）
- `src/components/domain/CaseFilterBar.tsx`

---

### B-3: CaseFilterBar の検索デバウンス修正 [中]

**問題**: `onChange` 内の `setTimeout` の戻り値（cleanup 関数）は React の `onChange` に返しても無視される。連続入力で複数の `router.push` が走る。

**修正内容**:

`useRef` でタイマーIDを保持し、前のタイマーをキャンセルする:
```tsx
// src/components/domain/CaseFilterBar.tsx
const debounceRef = useRef<ReturnType<typeof setTimeout>>();

// onChange 内
onChange={(e) => {
  const v = e.target.value;
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => updateParam("search", v), 300);
}}
```

**対象ファイル**:
- `src/components/domain/CaseFilterBar.tsx`

---

### B-4: 受講者ごとの書類確認の実装 [高]

**問題**: `DocumentTabClient.tsx` の `ParticipantRequirements` がプレースホルダのまま。FR-021 未達。

**修正内容**:

1. **ParticipantRequirements コンポーネントの実装** — `DocumentTabClient.tsx:289-308`
   - 受講者IDを受け取り、当該受講者の `document_requirements` を API 経由で取得
   - 各書類要件のステータス（pending / received / returned / approved）を一覧表示
   - アップロード・差替ボタンを配置（既存の `DocumentUploadButton` を再利用）

2. **API エンドポイント追加**: `GET /api/cases/[caseId]/participants/[participantId]/documents`
   - 受講者に紐づく `document_requirements` と関連 `documents` を返す

3. **documents/page.tsx** の Server Component 側でも受講者データを適切にフェッチし、Client Component に渡す（`participantSummaries` は既にフェッチ済みなので、それを活用）

**対象ファイル**:
- `src/app/(dashboard)/cases/[id]/documents/DocumentTabClient.tsx`
- `src/app/api/cases/[caseId]/participants/[participantId]/documents/route.ts` （新規）
- `src/server/repositories/documents.ts`（受講者書類取得クエリ追加）

---

## フェーズC: 機能追加（仕様充足）

> フェーズBが完了し主要導線が機能する状態で着手。C-1〜C-3 は **並行実施可**。

### C-1: 案件作成時のチェックリスト・書類テンプレート展開

**問題**: FR-001 が求める「案件作成時の初期チェックリスト / 必要書類テンプレート展開」が未実装。

**修正内容**:

1. **チェックリストテンプレート seed の実装**
   - `supabase/seed/05_checklist_templates.sql` に助成金種別ごとの初期チェックリスト項目を投入
   - テーブル `checklist_templates` が存在しない場合は migration で作成

2. **案件作成時のフック追加** — `src/server/usecases/cases/actions.ts:63` 付近
   - 案件作成後、助成金種別に基づいて:
     - タスクテンプレート → tasks テーブルに初期タスク展開（既存実装を維持）
     - チェックリストテンプレート → checklist_items テーブルに展開
     - 書類テンプレート → document_requirements テーブルに必要書類を自動生成

3. **書類テンプレートマスタ** — `document_requirement_templates` テーブルを追加
   - 助成金種別 × 書類種別の組み合わせで、企業向け・受講者向けの必要書類を定義
   - migration で作成 + seed で初期データ投入

**対象ファイル**:
- `supabase/migrations/` に新規 migration（checklist_items, document_requirement_templates）
- `supabase/seed/05_checklist_templates.sql`
- `supabase/seed/` に書類テンプレート seed（新規）
- `src/server/usecases/cases/actions.ts`
- `src/server/services/` にテンプレート展開サービス（新規）

---

### C-2: 受講者追加時の個人書類要件自動展開

**問題**: FR-020/021 に対し、受講者作成時に個人書類の `document_requirements` が自動生成されない。

**修正内容**:

1. **participants/actions.ts** — 受講者作成後に書類テンプレートから個人書類要件を展開
   ```ts
   // 受講者レコード作成後
   await expandParticipantDocumentRequirements(caseId, participantId, subsidyTypeId);
   ```

2. **展開ロジック** — `document_requirement_templates` から `scope = 'participant'` のテンプレートを取得し、`document_requirements` に挿入
   - C-1 の書類テンプレートマスタに依存するため、C-1 完了後に実装可能
   - ただし C-1 と同時並行で進め、テンプレートマスタの定義が固まり次第マージする運用も可

**対象ファイル**:
- `src/server/usecases/participants/actions.ts`
- `src/server/services/document-requirements.ts`（新規 or 既存拡張）

---

### C-3: 案件一覧・詳細の仕様充足

**問題**: 保存フィルタ・ソート・不足書類件数・未完了タスク件数・次回期限が案件一覧に未反映。案件詳細にタイムライン / 変更履歴タブがない。

**修正内容**:

#### 案件一覧の強化

1. **SavedFilterBar の接続** — `cases/page.tsx` に `SavedFilterBar` コンポーネントを配置
   - 既にコンポーネントは実装済み（`SavedFilterBar.tsx`）、API も存在（`/api/saved-filters`）
   - `cases/page.tsx` の `CaseFilterBar` の上に配置するだけ:
     ```tsx
     <SavedFilterBar scope="cases" currentParams={{ status, owner, search }} />
     ```

2. **案件一覧に補足列を追加** — テーブルヘッダーに以下を追加:
   - 不足書類数 (`insufficient_count` — `case_document_summary` ビューから取得)
   - 未完了タスク数
   - 次回期限（初回 or 最終のうち近い方）

3. **listCases リポジトリの拡張** — `case_document_summary` ビューと `tasks` テーブルを LEFT JOIN して補足情報を返す

#### 案件詳細にタイムラインタブを追加

4. **タイムラインタブ** — `/cases/[id]/timeline` に `page.tsx` を作成
   - `audit_logs` テーブルから `target_type = 'case'` かつ `target_id = caseId` のログを時系列で表示
   - ステータス変更・書類アップロード・タスク完了などのイベントを可視化
   - 案件詳細のタブナビ（`cases/[id]/page.tsx:82`）に「変更履歴」タブを追加

**対象ファイル**:
- `src/app/(dashboard)/cases/page.tsx`
- `src/server/repositories/cases.ts`
- `src/app/(dashboard)/cases/[id]/page.tsx`（タブナビ追加）
- `src/app/(dashboard)/cases/[id]/timeline/page.tsx`（新規）
- `src/server/repositories/audit-log.ts`（案件タイムライン取得クエリ追加）

---

## フェーズD: 品質・運用

> フェーズC と並行して着手可能だが、機能面の安定を優先。D-1〜D-3 は **並行実施可**。

### D-1: テストスクリプトの追加

**問題**: `package.json` に `test` スクリプトがない。Vitest / Playwright の設定もない。

**修正内容**:

1. **Vitest のセットアップ**
   - `vitest` と `@vitejs/plugin-react` を devDependencies に追加
   - `vitest.config.ts` 作成
   - `package.json` に追加:
     ```json
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
     ```

2. **最低限のテストケース作成** — 以下を優先:
   - `server/repositories/documents.ts` のビジネスロジック（registerDocument のバリデーション）
   - `lib/rbac.ts` の権限判定
   - `lib/constants/case-status.ts` のステータス定義整合性

**対象ファイル**:
- `package.json`
- `vitest.config.ts`（新規）
- `tests/unit/` 配下（新規）

---

### D-2: 運用監視ジョブの骨組み

**問題**: `vercel.json` の `crons` が空。日次期限監視や非同期処理が未着手。

**修正内容**:

1. **期限監視ジョブの作成** — `src/app/api/cron/deadline-check/route.ts`
   - `CRON_SECRET` ヘッダーで認証
   - `document_requirements` の `due_date` が翌日以内のものを抽出
   - `cases` の `pre_application_due_date` / `final_application_due_date` が翌週以内のものを抽出
   - 結果を `notifications` テーブルに書き込む（通知テーブルが未存在なら migration で作成）

2. **vercel.json の crons 設定**:
   ```json
   "crons": [
     {
       "path": "/api/cron/deadline-check",
       "schedule": "0 9 * * *"
     }
   ]
   ```

3. 通知テーブルが未存在の場合は migration で作成（`notifications` テーブル）

**対象ファイル**:
- `vercel.json`
- `src/app/api/cron/deadline-check/route.ts`（新規）
- `supabase/migrations/` に新規 migration（notifications テーブル）

---

### D-3: lint 全件修正 & CI 整備

**修正内容**:

1. `npm run lint:fix` でオート修正
2. 残る手動修正（A-4 で対応済みの `DocumentPreview.tsx` / `import-cases.ts` を含む）
3. CI で `lint` → `typecheck` → `build` → `test` が通ることを確認

**対象ファイル**:
- 各種ソースファイル（lint 指摘箇所）

---

## 依存関係まとめ

```
A-1 (顧客アップロード)      ─┐
A-2 (閲覧権限)              ─┤
A-3 (bulk API スキーマ修正)  ─┼─→ フェーズA完了
A-4 (lint修正)              ─┘
                               ↓
B-1 (404ページ修復)          ─┐
B-2 (ダッシュボードフィルタ)  ─┤
B-3 (デバウンス修正)          ─┼─→ フェーズB完了
B-4 (受講者書類)              ─┘
                               ↓
C-1 (チェックリスト展開)      ─┐
C-2 (受講者書類要件展開) ※C-1依存 ─┤─→ フェーズC完了
C-3 (一覧・詳細仕様充足)      ─┘
                               ↓
D-1 (テスト)                 ─┐
D-2 (運用監視ジョブ)          ─┼─→ フェーズD完了
D-3 (lint & CI)              ─┘
```

**例外**: C-2 は C-1 の書類テンプレートマスタに依存するため、C-1 → C-2 は直列。
**例外**: D-3 の lint 修正のうち A-4 に含まれる部分はフェーズA で先行対応済み。

---

## 実装時の注意事項

- 全修正は CLAUDE.md のルールに従うこと（特に UI デザインルール・監査ログ・論理削除）
- migration ファイルのタイムスタンプは既存の連番を維持: `20260412000004_xxx.sql` 〜
- 新規ページ作成時は `export const metadata` を必ず付ける
- Server Action / Route Handler 内の権限チェックを忘れないこと
- テスト観点: 各フェーズ完了時に `npm run typecheck && npm run build` が通ることを確認
