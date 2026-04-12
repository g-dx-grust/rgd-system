-- ============================================================
-- Migration: Step 7 — LMS進捗・視聴ログ管理
-- 作成日: 2026-04-12
-- Step: 7 LMS進捗・視聴ログ管理
-- ============================================================

-- ------------------------------------------------------------
-- LMS連携設定 (lms_settings)
-- 案件単位またはシステム全体の LMS 接続設定を保持する。
-- 将来的に API 連携へ移行する際も、adapter_type を変えるだけで対応可能。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,  -- NULL = システム全体設定
  adapter_type    TEXT NOT NULL DEFAULT 'csv',                   -- 'csv' | 'api' | 'webhook'
  config          JSONB NOT NULL DEFAULT '{}',                   -- adapter固有設定（暗号化対象）
  stagnation_days INTEGER NOT NULL DEFAULT 7,                    -- N日以上アクセスなし = 停滞
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lms_settings_adapter_type_check CHECK (
    adapter_type IN ('csv', 'api', 'webhook', 'manual')
  ),
  CONSTRAINT lms_settings_stagnation_days_check CHECK (stagnation_days BETWEEN 1 AND 365)
);

COMMENT ON TABLE lms_settings IS 'LMS連携設定（案件単位またはシステム全体）';
COMMENT ON COLUMN lms_settings.case_id IS 'NULL の場合はシステム全体のデフォルト設定';
COMMENT ON COLUMN lms_settings.adapter_type IS 'LMS連携方式: csv / api / webhook / manual';
COMMENT ON COLUMN lms_settings.stagnation_days IS 'この日数以上アクセスがない受講者を停滞と判定する';

CREATE TRIGGER lms_settings_updated_at
  BEFORE UPDATE ON lms_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_lms_settings_case_id ON lms_settings (case_id);

-- ------------------------------------------------------------
-- LMS進捗スナップショット (lms_progress_snapshots)
-- 受講者ごとの進捗を同期タイミングで記録するスナップショット。
-- 上書きではなく追記（版管理）し、最新レコードを正本として扱う。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_progress_snapshots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  participant_id      UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  sync_log_id         UUID,                                       -- FK追加はsync_logs作成後に設定
  lms_user_id         TEXT,                                       -- LMS側のユーザー識別子
  progress_rate       NUMERIC(5, 2) NOT NULL DEFAULT 0.00,        -- 0.00〜100.00（%）
  is_completed        BOOLEAN NOT NULL DEFAULT FALSE,
  last_access_at      TIMESTAMPTZ,                                -- LMS上の最終アクセス日時
  total_watch_seconds INTEGER,                                    -- 累計視聴秒数
  raw_payload         JSONB,                                      -- LMSからの生データ（検索対象外）
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),         -- このスナップショットの取得日時
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lms_progress_rate_check CHECK (progress_rate BETWEEN 0 AND 100)
);

COMMENT ON TABLE lms_progress_snapshots IS 'LMS進捗スナップショット（受講者単位・同期ごとに追記）';
COMMENT ON COLUMN lms_progress_snapshots.progress_rate IS '進捗率（0.00〜100.00%）';
COMMENT ON COLUMN lms_progress_snapshots.last_access_at IS 'LMS上の最終アクセス日時（停滞判定に使用）';
COMMENT ON COLUMN lms_progress_snapshots.raw_payload IS 'LMS連携の生データ。検索・正本用途には個別カラムを使うこと';

CREATE INDEX IF NOT EXISTS idx_lms_progress_case_id         ON lms_progress_snapshots (case_id);
CREATE INDEX IF NOT EXISTS idx_lms_progress_participant_id  ON lms_progress_snapshots (participant_id);
CREATE INDEX IF NOT EXISTS idx_lms_progress_sync_log_id     ON lms_progress_snapshots (sync_log_id);
CREATE INDEX IF NOT EXISTS idx_lms_progress_synced_at       ON lms_progress_snapshots (synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_progress_last_access     ON lms_progress_snapshots (last_access_at);

-- 受講者ごとの最新スナップショットを高速に取得するための複合インデックス
CREATE INDEX IF NOT EXISTS idx_lms_progress_latest
  ON lms_progress_snapshots (case_id, participant_id, synced_at DESC);

-- ------------------------------------------------------------
-- LMS同期ログ (lms_sync_logs)
-- 同期の実行履歴・成否・エラー内容を記録する。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_sync_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  adapter_type     TEXT NOT NULL DEFAULT 'csv',
  status           TEXT NOT NULL DEFAULT 'running',              -- running / success / partial / failed
  triggered_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_records    INTEGER,
  success_records  INTEGER,
  error_records    INTEGER,
  error_detail     TEXT,                                         -- 失敗時のエラーメッセージ
  source_filename  TEXT,                                         -- CSVファイル名など
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lms_sync_logs_status_check CHECK (
    status IN ('running', 'success', 'partial', 'failed')
  ),
  CONSTRAINT lms_sync_logs_adapter_type_check CHECK (
    adapter_type IN ('csv', 'api', 'webhook', 'manual')
  )
);

COMMENT ON TABLE lms_sync_logs IS 'LMS同期実行ログ（成否・エラー詳細を記録）';
COMMENT ON COLUMN lms_sync_logs.status IS 'running: 実行中 / success: 全件成功 / partial: 一部成功 / failed: 全件失敗';

CREATE TRIGGER lms_sync_logs_updated_at_placeholder
  BEFORE UPDATE ON lms_sync_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_lms_sync_logs_case_id    ON lms_sync_logs (case_id);
CREATE INDEX IF NOT EXISTS idx_lms_sync_logs_status     ON lms_sync_logs (status);
CREATE INDEX IF NOT EXISTS idx_lms_sync_logs_started_at ON lms_sync_logs (started_at DESC);

-- sync_log_id FK を後付けで追加
ALTER TABLE lms_progress_snapshots
  ADD CONSTRAINT fk_lms_progress_sync_log
  FOREIGN KEY (sync_log_id) REFERENCES lms_sync_logs(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- RLS ポリシー
-- ------------------------------------------------------------
ALTER TABLE lms_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_sync_logs          ENABLE ROW LEVEL SECURITY;

-- 認証ユーザーに SELECT を許可（詳細な権限はアプリ層で制御）
CREATE POLICY lms_settings_select ON lms_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lms_settings_insert ON lms_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY lms_settings_update ON lms_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY lms_progress_select ON lms_progress_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lms_progress_insert ON lms_progress_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY lms_sync_logs_select ON lms_sync_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lms_sync_logs_insert ON lms_sync_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY lms_sync_logs_update ON lms_sync_logs
  FOR UPDATE TO authenticated USING (true);
