-- ============================================================
-- Migration: Step 8 — 終了申請準備・最終申請対応
-- 作成日: 2026-04-12
-- Step: 8 終了申請準備・最終申請対応
-- ============================================================

-- ------------------------------------------------------------
-- アンケート管理 (surveys)
-- FR-070 アンケート依頼
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS surveys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  participant_id  UUID REFERENCES participants(id) ON DELETE SET NULL,
  survey_type     TEXT NOT NULL DEFAULT 'post_training',   -- post_training / pre_training / other
  status          TEXT NOT NULL DEFAULT 'not_sent',        -- not_sent / sent / responded / skipped
  sent_at         TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  sent_to         TEXT,                                    -- 送付先メールアドレス（記録用）
  note            TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT surveys_survey_type_check CHECK (
    survey_type IN ('post_training', 'pre_training', 'other')
  ),
  CONSTRAINT surveys_status_check CHECK (
    status IN ('not_sent', 'sent', 'responded', 'skipped')
  )
);

COMMENT ON TABLE surveys IS 'アンケート送付/回収管理';

CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_surveys_case_id        ON surveys (case_id);
CREATE INDEX IF NOT EXISTS idx_surveys_participant_id ON surveys (participant_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status         ON surveys (status);
CREATE INDEX IF NOT EXISTS idx_surveys_deleted_at     ON surveys (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 終了申請準備チェックリスト (final_review_items)
-- FR-072 最終確認チェックリスト
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS final_review_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  item_type    TEXT NOT NULL,   -- viewing_log / survey / evidence / lms_progress / document / other
  label        TEXT NOT NULL,
  is_checked   BOOLEAN NOT NULL DEFAULT FALSE,
  checked_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at   TIMESTAMPTZ,
  note         TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT final_review_items_item_type_check CHECK (
    item_type IN ('viewing_log', 'survey', 'evidence', 'lms_progress', 'document', 'other')
  )
);

COMMENT ON TABLE final_review_items IS '終了申請準備チェックリスト（最終確認）';

CREATE TRIGGER final_review_items_updated_at
  BEFORE UPDATE ON final_review_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_final_review_items_case_id    ON final_review_items (case_id);
CREATE INDEX IF NOT EXISTS idx_final_review_items_deleted_at ON final_review_items (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 最終申請パッケージ履歴 (final_specialist_linkages)
-- 最終社労士連携の履歴記録
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS final_specialist_linkages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  package_id      UUID REFERENCES application_packages(id) ON DELETE SET NULL,
  linked_to       TEXT,                   -- 連携先（社労士名 / メールアドレス等）
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note            TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE final_specialist_linkages IS '最終社労士連携履歴';

CREATE TRIGGER final_specialist_linkages_updated_at
  BEFORE UPDATE ON final_specialist_linkages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_final_specialist_linkages_case_id ON final_specialist_linkages (case_id);

-- ------------------------------------------------------------
-- RLS ポリシー
-- ------------------------------------------------------------

ALTER TABLE surveys                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_review_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_specialist_linkages ENABLE ROW LEVEL SECURITY;

-- 内部スタッフは自テナントの全データを参照・操作可
-- 簡易ポリシー: service_role / authenticated はすべて許可（アプリ層で権限制御）
CREATE POLICY surveys_authenticated ON surveys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY final_review_items_authenticated ON final_review_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY final_specialist_linkages_authenticated ON final_specialist_linkages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
