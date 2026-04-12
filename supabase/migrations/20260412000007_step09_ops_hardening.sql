-- =============================================================
-- Step 9: 運用強化・監視・高速化
-- =============================================================

-- -----------------------------------------------------------
-- 1. saved_filters: 保存フィルタ
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_filters (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  scope         TEXT        NOT NULL DEFAULT 'cases',  -- 'cases' | 'documents' etc.
  filter_params JSONB       NOT NULL DEFAULT '{}',
  is_default    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_scope   ON saved_filters (scope);

-- デフォルトフィルタは1ユーザー・1スコープにつき1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS uidx_saved_filters_default
  ON saved_filters (user_id, scope)
  WHERE is_default = TRUE;

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_filters_own ON saved_filters
  USING (user_id = auth.uid());

-- -----------------------------------------------------------
-- 2. notifications: アプリ内通知
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  body         TEXT        NOT NULL DEFAULT '',
  link_url     TEXT,
  category     TEXT        NOT NULL DEFAULT 'info',  -- 'info'|'warning'|'error'|'task'
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  case_id      UUID        REFERENCES cases(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_case_id   ON notifications (case_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_own ON notifications
  USING (user_id = auth.uid());

-- -----------------------------------------------------------
-- 3. KPI ビュー: v_dashboard_kpi
--    管理者向けダッシュボードの集計値
-- -----------------------------------------------------------
CREATE OR REPLACE VIEW v_dashboard_kpi AS
SELECT
  -- ステータス別件数（アクティブ案件）
  COUNT(*) FILTER (
    WHERE status NOT IN ('completed','cancelled') AND deleted_at IS NULL
  )::INT AS active_cases,

  COUNT(*) FILTER (
    WHERE status = 'completed' AND deleted_at IS NULL
      AND DATE_TRUNC('month', updated_at AT TIME ZONE 'Asia/Tokyo')
          = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Tokyo')
  )::INT AS completed_this_month,

  COUNT(*) FILTER (
    WHERE status IN ('on_hold','returned') AND deleted_at IS NULL
  )::INT AS stuck_cases,

  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND status NOT IN ('completed','cancelled')
      AND (
        (pre_application_due_date  IS NOT NULL AND pre_application_due_date  < CURRENT_DATE)
        OR
        (final_application_due_date IS NOT NULL AND final_application_due_date < CURRENT_DATE)
      )
  )::INT AS overdue_cases

FROM cases;

-- -----------------------------------------------------------
-- 4. ビュー: v_stalled_cases
--    7日以上 updated_at が動いていない進行中案件
-- -----------------------------------------------------------
CREATE OR REPLACE VIEW v_stalled_cases AS
SELECT
  c.id,
  c.case_code,
  c.case_name,
  c.status,
  c.updated_at,
  c.pre_application_due_date,
  c.final_application_due_date,
  o.legal_name AS organization_name,
  up.display_name AS owner_name,
  EXTRACT(DAY FROM NOW() - c.updated_at)::INT AS stalled_days
FROM cases c
LEFT JOIN organizations   o  ON o.id = c.organization_id
LEFT JOIN user_profiles   up ON up.id = c.owner_user_id
WHERE c.deleted_at IS NULL
  AND c.status NOT IN ('completed', 'cancelled', 'on_hold')
  AND c.updated_at < NOW() - INTERVAL '7 days'
ORDER BY c.updated_at ASC;

-- -----------------------------------------------------------
-- 5. ビュー: v_overdue_doc_requirements
--    期限超過の書類要求（回収中かつ未提出 or 不備）
-- -----------------------------------------------------------
CREATE OR REPLACE VIEW v_overdue_doc_requirements AS
SELECT
  dr.id,
  dr.case_id,
  c.case_code,
  c.case_name,
  c.status AS case_status,
  dt.name AS document_type_name,
  dr.due_date,
  dr.status AS doc_status,
  EXTRACT(DAY FROM NOW() - dr.due_date::TIMESTAMPTZ)::INT AS overdue_days
FROM document_requirements dr
JOIN cases          c  ON c.id  = dr.case_id
JOIN document_types dt ON dt.id = dr.document_type_id
WHERE dr.due_date < CURRENT_DATE
  AND dr.status IN ('pending', 'returned')
  AND c.deleted_at IS NULL
  AND c.status NOT IN ('completed', 'cancelled')
ORDER BY dr.due_date ASC;

-- -----------------------------------------------------------
-- 6. 追加インデックス（クエリ最適化）
-- -----------------------------------------------------------

-- cases: 複合インデックス（一覧の典型フィルタ）
CREATE INDEX IF NOT EXISTS idx_cases_status_deleted
  ON cases (status, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_updated_at
  ON cases (updated_at DESC)
  WHERE deleted_at IS NULL;

-- document_requirements: due_date + status 複合（期限超過チェック）
CREATE INDEX IF NOT EXISTS idx_doc_req_due_status
  ON document_requirements (due_date, status)
  WHERE status IN ('pending', 'returned');

-- tasks: due_date + status 複合（期限タスク集計）
CREATE INDEX IF NOT EXISTS idx_tasks_due_status
  ON tasks (due_date, status)
  WHERE status IN ('open', 'in_progress');

-- audit_logs: 検索用複合インデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON audit_logs (target_type, target_id)
  WHERE target_type IS NOT NULL;

-- notifications: 既読未読カウント高速化
CREATE INDEX IF NOT EXISTS idx_notifications_unread_count
  ON notifications (user_id, created_at DESC)
  WHERE is_read = FALSE;

-- -----------------------------------------------------------
-- 7. updated_at 自動更新トリガー（saved_filters）
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saved_filters_updated_at
  BEFORE UPDATE ON saved_filters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
