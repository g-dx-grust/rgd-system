# RGDシステム コードレビュー報告書

本レビューでは、**実運用を阻害しやすい導線切れ・未実装機能・更新反映不備・セキュリティ/運用リスク**を優先して確認しました。以下は、現時点でClaudeCodeに修正依頼を出す際に優先度高く扱うべき項目です。

| 優先度 | 区分 | 影響概要 | 推奨対応 |
| --- | --- | --- | --- |
| High | 導線不整合 | サイドバーや詳細画面から未実装・不存在ページへ遷移できる | 未完成機能は導線を閉じるか最小実装を入れる |
| High | 機能未実装 | 申請パッケージのZIP一括ダウンロードが未実装 | サーバー側でZIP生成し配布する |
| High | 機能未実装 | 案件編集が未実装で案件情報更新ができない | 新規作成フォームを共通化して編集画面を実装する |
| Medium | 更新反映不備 | 書類操作後に対象案件ページのキャッシュが適切に無効化されない | 実際の `caseId` を使って再検証する |
| Medium | 運用/セキュリティ | 管理者シードに固定仮パスワードがハードコードされている | 実行時生成または環境変数化へ変更する |
| Medium | 外部連携 | LMSアダプタがCSV以外未実装で業務フローが途切れる | 対応範囲をUI上で明示し、未対応選択を禁止する |

## 1. サイドバーが未実装ページへ直接遷移できる

`src/components/layout/Sidebar.tsx` では、主要ナビゲーションとして `/participants`、`/documents`、`/billing`、`/settings` へのリンクが常時表示されています。しかし、対応するページの一部はプレースホルダー実装のままです。

| ファイル | 確認内容 | 問題 |
| --- | --- | --- |
| `src/components/layout/Sidebar.tsx` | `href: "/participants"`, `"/documents"`, `"/billing"`, `"/settings"` を定義 | 主要導線として公開されている |
| `src/app/(dashboard)/participants/page.tsx` | 「この機能は現在準備中です。」 | 実業務で使えない |
| `src/app/(dashboard)/documents/page.tsx` | 同上 | 書類管理トップ導線が死んでいる |
| `src/app/(dashboard)/billing/page.tsx` | 同上 | 請求管理トップ導線が死んでいる |
| `src/app/(dashboard)/settings/page.tsx` | 同上 | 設定導線が死んでいる |

この状態では、ユーザーが**主要メニューから未完成ページへ到達してしまい、システム全体の完成度を著しく損ないます**。最低限、未実装ページは非表示化するか、案件単位の既存機能へリダイレクトする設計へ変更すべきです。

### ClaudeCodeへの修正依頼例

> サイドバーでリンクしている `/participants` `/documents` `/billing` `/settings` のうち、実装未完了のページを洗い出してください。未完成ページへ遷移させないよう、(1) 該当メニューを一時的に非表示にする、または (2) 既存の利用可能画面へリダイレクトする形に修正してください。ユーザーがトップナビゲーションから「準備中」ページに到達しない状態を作ってください。

## 2. 案件編集ボタンが存在するのに編集画面が未実装

案件詳細には編集ボタンがありますが、遷移先ページはプレースホルダーです。

| ファイル | 確認内容 | 問題 |
| --- | --- | --- |
| `src/app/(dashboard)/cases/[id]/page.tsx` | `/cases/${id}/edit` への編集導線あり | ユーザーは編集可能だと認識する |
| `src/app/(dashboard)/cases/[id]/edit/page.tsx` | 「この機能は現在準備中です。」 | 実際には編集できない |

案件管理システムにおいて案件編集不可は致命的です。**実運用では案件名、担当者、期限、申請情報、企業紐付けなどの修正が頻繁に発生するため、編集導線を残したまま未実装にするのは避けるべき**です。

### ClaudeCodeへの修正依頼例

> 案件詳細画面の編集導線 `/cases/[id]/edit` が未実装です。案件新規作成フォームを流用・共通化し、既存案件の初期値を読み込める編集画面を実装してください。保存後は詳細画面へ戻し、対象案件ページの再検証も行ってください。もし短期で完成できない場合は、編集ボタン自体を一時的に非表示化してください。

## 3. 組織詳細に編集ボタンがあるが、編集ページ自体が存在しない

`src/app/(dashboard)/organizations/[id]/page.tsx` では `/organizations/${id}/edit` へのボタンを表示していますが、`organizations` 配下には `edit/page.tsx` が存在しません。これはプレースホルダーですらなく、**クリック時に404となる導線不整合**です。

| ファイル | 確認内容 | 問題 |
| --- | --- | --- |
| `src/app/(dashboard)/organizations/[id]/page.tsx` | 編集ボタンが `/organizations/${id}/edit` を指す | 編集可能に見える |
| `src/app/(dashboard)/organizations` 配下構成 | `page.tsx`, `new/page.tsx`, `[id]/page.tsx` のみ | 編集ページ未作成 |

### ClaudeCodeへの修正依頼例

> 組織詳細画面の編集ボタンが存在しますが、`/organizations/[id]/edit` ページがありません。新規作成フォームの共通化によって編集画面を追加するか、少なくとも404導線にならないようボタンを非表示にしてください。関連する連絡先編集フローとの整合性も確認してください。

## 4. 申請パッケージの「ZIPダウンロード」が実際にはZIPを返していない

`src/app/api/cases/[id]/packages/[packageId]/download/route.ts` は、名前と用途からZIP一括ダウンロードAPIに見えますが、実際には署名付きURLのJSON配列を返しています。コードコメントにも未実装であることが明示されています。

| ファイル | 確認内容 | 問題 |
| --- | --- | --- |
| `src/app/api/cases/[id]/packages/[packageId]/download/route.ts` | コメントで「ZIP 一括ダウンロードは未実装」と明記 | API名と実態が乖離 |
| 同ファイルのレスポンス | `files: signedUrls` と `note` をJSON返却 | エンドユーザーの期待と一致しない |

助成金・書類申請業務では**複数書類の一括取得**が実務上ほぼ必須です。個別URLダウンロードに依存すると、作業者負担・誤取得・取りこぼしが増えます。

### ClaudeCodeへの修正依頼例

> `GET /api/cases/[id]/packages/[packageId]/download` はAPI名に反してZIPを返していません。パッケージ内の対象ファイルをまとめてZIP化し、ストリーミングまたは一時保存したZIPのダウンロードレスポンスを返すよう修正してください。難しい場合でも、API名・UI文言・利用者向け説明を現状仕様に合わせて変更し、誤解を生まないようにしてください。

## 5. 書類操作後の `revalidatePath` が動的案件IDを使っておらず、更新反映漏れの可能性が高い

`src/server/usecases/documents/actions.ts` では、差戻し・承認・要件追加・削除の後に `revalidatePath("/cases/[id]/documents", "page")` を呼んでいます。しかし、これは**実際の案件URLではなく動的セグメント文字列そのもの**であり、対象ページが意図通り再検証されない可能性があります。

| ファイル | 行 | 問題 |
| --- | --- | --- |
| `src/server/usecases/documents/actions.ts` | 54 | `revalidatePath("/cases/[id]/documents", "page")` |
| `src/server/usecases/documents/actions.ts` | 86 | 同上 |
| `src/server/usecases/documents/actions.ts` | 119 | 同上 |
| `src/server/usecases/documents/actions.ts` | 149 | 同上 |

この不備があると、承認や差戻しを行っても**画面上で状態が更新されない、または手動再読込しないと反映されない**という、実務で非常にストレスの大きい挙動につながります。

### ClaudeCodeへの修正依頼例

> `src/server/usecases/documents/actions.ts` の `revalidatePath("/cases/[id]/documents", "page")` は固定文字列になっており、対象案件ページの再検証として不正確です。各アクションで `caseId` を取得し、`revalidatePath(`/cases/${caseId}/documents`)` のように実URLで再検証するよう修正してください。必要に応じて案件詳細 `/cases/${caseId}` の再検証も追加してください。

## 6. 管理者ユーザー初期登録スクリプトに固定仮パスワードがハードコードされている

`scripts/seed-admin-users.ts` では `TEMP_PASSWORD = "RGD_TempPass001!"` がソースに固定で埋め込まれています。複数管理者アカウントに同一初期パスワードを付与する構成であり、**開発環境流用や運用時の誤使用が起きた場合に危険**です。

| ファイル | 確認内容 | 問題 |
| --- | --- | --- |
| `scripts/seed-admin-users.ts` | `const TEMP_PASSWORD = "RGD_TempPass001!";` | 固定資格情報の埋め込み |
| 同ファイル | 登録完了時に仮パスワードを標準出力 | 共有・流出リスクを増やす |

### ClaudeCodeへの修正依頼例

> `scripts/seed-admin-users.ts` の固定仮パスワードを廃止してください。環境変数 `ADMIN_TEMP_PASSWORD` を必須にするか、実行時に十分強いランダムパスワードを生成してCSV/安全な出力先へ渡す方式に変更してください。少なくともソースコードへ平文資格情報を残さない構成にしてください。

## 7. LMS連携がCSV以外未実装で、設定次第では実行時例外になる

`src/lib/lms/factory.ts` では `csv` のみ実装されており、`api` `webhook` `manual` は `throw new Error(...)` です。もしUIやマスタ設定でこれらの値が選択可能なら、**運用時に同期処理が即時失敗**します。

| ファイル | 確認内容 | 問題 |
| --- | --- | --- |
| `src/lib/lms/factory.ts` | `csv` のみ `new CsvLmsAdapter()` | 実装範囲が限定的 |
| 同ファイル | `api`, `webhook`, `manual` は例外送出 | 設定値次第で業務停止 |

### ClaudeCodeへの修正依頼例

> `src/lib/lms/factory.ts` で `api`, `webhook`, `manual` が未実装のまま例外送出になっています。現時点で未対応なら、UIや設定値でこれらを選択不可にし、既存データに未対応値が入っても安全に失敗理由を表示できるようにしてください。対応予定があるなら、最低でも `manual` は例外ではなく手動運用前提のアダプタとして実装してください。

## 修正優先順位の提案

まずは**ユーザーがすぐ踏む導線の破綻**を止めるべきです。したがって、短期優先順位は以下が妥当です。

| 順位 | 対応項目 | 理由 |
| --- | --- | --- |
| 1 | サイドバー/詳細画面の死んだ導線の閉鎖 | 利用者が即座に遭遇するため |
| 2 | 案件編集・組織編集の実装または導線撤去 | 基幹マスタ更新ができない/404になるため |
| 3 | ZIP一括ダウンロード実装 | 助成金書類運用の実務負荷が大きいため |
| 4 | 書類操作後の再検証修正 | 日常運用で状態反映の不信感を招くため |
| 5 | 固定仮パスワードの廃止 | セキュリティ・運用事故防止 |
| 6 | LMS未対応アダプタの封じ込み | 設定起因の実行時障害防止 |

## ClaudeCodeへそのまま渡せる総合作業指示

以下をそのままClaudeCodeへ渡せます。

> RGDシステムのコードレビュー結果に基づき、以下を優先度順に修正してください。  
> 1. サイドバーや詳細画面から、未実装ページ・不存在ページへ遷移する導線をなくしてください。対象は少なくとも `/participants` `/documents` `/billing` `/settings` `/cases/[id]/edit` `/organizations/[id]/edit` です。未完成なら一時的に導線を隠し、可能なら編集画面を実装してください。  
> 2. `GET /api/cases/[id]/packages/[packageId]/download` はZIPダウンロードAPIとして期待されるため、実際にZIPを返すよう修正してください。難しい場合はAPI名・UI文言・説明を現仕様に合わせて整合させてください。  
> 3. `src/server/usecases/documents/actions.ts` の `revalidatePath("/cases/[id]/documents", "page")` を、実際の `caseId` を用いた再検証へ修正してください。必要に応じて案件詳細ページも再検証してください。  
> 4. `scripts/seed-admin-users.ts` の固定仮パスワードを廃止し、環境変数またはランダム生成方式に変更してください。ソースコードに平文資格情報を残さないでください。  
> 5. `src/lib/lms/factory.ts` で未実装の `api` `webhook` `manual` が選ばれたときに実行時例外だけで終わらないようにし、未対応機能はUI/設定で選択不可にするか、安全なフォールバックを実装してください。  
> 修正後は、影響した画面・APIごとに動作確認観点もまとめてください。

必要であれば次のステップとして、私の方でこの報告をベースに**ClaudeCode向けのさらに詳細な修正プロンプト**や、**修正後の再レビュー観点チェックリスト**も作成できます。
