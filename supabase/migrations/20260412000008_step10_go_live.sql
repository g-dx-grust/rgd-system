-- ============================================================
-- Migration: Step 10 — 本番化・移行・運用開始
-- 作成日: 2026-04-12
-- Step: 10 本番化・移行・運用開始
-- ============================================================

-- ============================================================
-- 1. import_jobs: CSVインポート実行履歴
-- ============================================================
-- CSVインポートの実行記録を残し、重複インポートの防止・監査に使用する

CREATE TABLE IF NOT EXISTS import_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      TEXT        NOT NULL DEFAULT 'cases',        -- 'cases' | 'participants' | 'organizations'
  file_name     TEXT        NOT NULL,
  file_size     BIGINT,                                       -- bytes
  total_rows    INTEGER,
  success_rows  INTEGER     NOT NULL DEFAULT 0,
  error_rows    INTEGER     NOT NULL DEFAULT 0,
  skip_rows     INTEGER     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'pending',       -- pending / running / completed / failed
  dry_run       BOOLEAN     NOT NULL DEFAULT FALSE,
  error_detail  JSONB,                                        -- エラー行の詳細 [{row, message}, ...]
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  executed_by   UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT import_jobs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  ),
  CONSTRAINT import_jobs_job_type_check CHECK (
    job_type IN ('cases', 'participants', 'organizations')
  )
);

COMMENT ON TABLE import_jobs IS 'CSVインポート実行履歴';
COMMENT ON COLUMN import_jobs.dry_run IS 'TRUEの場合はDBへの書き込みは行わない（検証専用）';
COMMENT ON COLUMN import_jobs.error_detail IS 'エラー行の詳細情報: [{row: N, message: "..."}, ...]';

CREATE INDEX IF NOT EXISTS idx_import_jobs_status     ON import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_job_type   ON import_jobs (job_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_executed_by ON import_jobs (executed_by);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs (created_at DESC);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Admin / Operations Manager のみ参照・作成可能
CREATE POLICY import_jobs_select ON import_jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY import_jobs_insert ON import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY import_jobs_update ON import_jobs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager')
        AND up.deleted_at IS NULL
    )
  );

-- ============================================================
-- 2. release_notes: リリースノート・変更履歴
-- ============================================================

CREATE TABLE IF NOT EXISTS release_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version     TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  released_at DATE        NOT NULL,
  created_by  UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE release_notes IS 'リリースノート・変更履歴';

CREATE INDEX IF NOT EXISTS idx_release_notes_released_at ON release_notes (released_at DESC);

ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;

-- 内部ユーザーは参照可
CREATE POLICY release_notes_select ON release_notes
  FOR SELECT TO authenticated USING (TRUE);

-- Admin のみ作成可
CREATE POLICY release_notes_insert ON release_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );

-- ============================================================
-- 3. system_settings: システム設定（KVストア）
-- ============================================================
-- メール送信設定・機能フラグなどをDBで管理する
-- クライアントサイドからは直接アクセスしない（Server Action経由のみ）

CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT,
  is_secret   BOOLEAN     NOT NULL DEFAULT FALSE,  -- TRUEの場合はUI表示時にマスクする
  updated_by  UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'システム設定KVストア（機能フラグ・通知設定等）';
COMMENT ON COLUMN system_settings.is_secret IS 'TRUEの場合はUI表示時に値をマスクする';

-- 初期設定値
INSERT INTO system_settings (key, value, description, is_secret) VALUES
  ('maintenance_mode',      'false',  'メンテナンスモード（trueにするとログイン画面にメンテナンス表示）', FALSE),
  ('email_notifications',   'false',  'メール通知の有効/無効（true/false）',                            FALSE),
  ('lark_notifications',    'false',  'Lark通知の有効/無効（true/false）',                             FALSE),
  ('max_file_size_mb',      '100',    'ファイルアップロード上限サイズ（MB）',                           FALSE),
  ('allowed_file_types',    'pdf,jpg,jpeg,png,xlsx,xls,docx,doc,csv,zip',
                                      'アップロード許可拡張子（カンマ区切り）',                          FALSE),
  ('case_list_page_size',   '50',     '案件一覧のデフォルトページサイズ',                               FALSE),
  ('signed_url_expires_in', '3600',   '署名付きURLの有効期限（秒）',                                   FALSE)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Admin のみ参照・更新可
CREATE POLICY system_settings_select ON system_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY system_settings_update ON system_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );

-- ============================================================
-- 4. 初期リリースノート
-- ============================================================

INSERT INTO release_notes (version, title, body, released_at) VALUES
  (
    '1.0.0',
    'RGDシステム 初回リリース',
    '## 主な機能

- 案件管理（ステータス駆動）
- 書類回収・ファイル管理
- 初回申請・社労士連携パッケージ
- 受理後対応・請求・証憑管理
- LMS進捗管理
- 最終申請対応
- ダッシュボード・通知
- 顧客向けポータル（書類提出）',
    '2026-04-12'
  )
ON CONFLICT DO NOTHING;
