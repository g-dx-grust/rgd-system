-- ============================================================
-- Migration: Step 6 — 受理後対応・開始案内・請求・証憑
-- 作成日: 2026-04-12
-- Step: 6 受理後対応・開始案内・請求・証憑
-- ============================================================

-- ------------------------------------------------------------
-- 請求管理 (invoices)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE,
  due_date        DATE,
  amount          NUMERIC(12, 0),                          -- 未決事項のため nullable
  billing_status  TEXT NOT NULL DEFAULT 'draft',
  sent_at         TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,  -- 請求書ファイル
  note            TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoices_billing_status_check CHECK (
    billing_status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')
  )
);

COMMENT ON TABLE invoices IS '請求管理';

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_invoices_case_id        ON invoices (case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_status ON invoices (billing_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date       ON invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at     ON invoices (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 証憑管理 (evidence_items)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  participant_id  UUID REFERENCES participants(id) ON DELETE SET NULL,
  evidence_type   TEXT NOT NULL DEFAULT 'other',           -- receipt / payslip / attendance / completion / other
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',         -- pending / collected / insufficient / confirmed
  due_date        DATE,
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  requested_at    TIMESTAMPTZ,
  collected_at    TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  note            TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evidence_items_type_check CHECK (
    evidence_type IN ('receipt', 'payslip', 'attendance', 'completion', 'other')
  ),
  CONSTRAINT evidence_items_status_check CHECK (
    status IN ('pending', 'collected', 'insufficient', 'confirmed')
  )
);

COMMENT ON TABLE evidence_items IS '証憑回収管理';

CREATE TRIGGER evidence_items_updated_at
  BEFORE UPDATE ON evidence_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_evidence_case_id       ON evidence_items (case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_participant_id ON evidence_items (participant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status        ON evidence_items (status);
CREATE INDEX IF NOT EXISTS idx_evidence_due_date      ON evidence_items (due_date);
CREATE INDEX IF NOT EXISTS idx_evidence_deleted_at    ON evidence_items (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- メッセージテンプレート (message_templates)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_type   TEXT NOT NULL,   -- start_guide / billing_notice / doc_request / questionnaire / other
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT message_templates_type_check CHECK (
    template_type IN ('start_guide', 'billing_notice', 'doc_request', 'questionnaire', 'reminder', 'other')
  )
);

COMMENT ON TABLE message_templates IS 'メッセージテンプレート管理';

CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_msg_templates_type       ON message_templates (template_type);
CREATE INDEX IF NOT EXISTS idx_msg_templates_deleted_at ON message_templates (deleted_at) WHERE deleted_at IS NULL;

-- 開始案内テンプレートの初期データ
INSERT INTO message_templates (template_type, name, subject, body) VALUES
  (
    'start_guide',
    '標準 開始案内',
    '【RGD】{{case_name}} 研修開始のご案内',
    E'{{contact_name}} 様\n\nいつもお世話になっております。株式会社グラストでございます。\n\nこのたびは、{{case_name}} の助成金申請が受理されましたことをご報告申し上げます。\n\n■ 受理日: {{acceptance_date}}\n■ 研修開始予定日: {{training_start_date}}\n■ 研修終了予定日: {{training_end_date}}\n\nつきましては、以下のとおりご対応をお願いいたします。\n\n【ご対応事項】\n1. 研修参加者へのご連絡\n2. 出勤記録・タイムカードの整備\n3. 証憑書類の準備（詳細は別途ご案内いたします）\n\nご不明点がございましたら、お気軽にご連絡ください。\n\n引き続きよろしくお願いいたします。'
  ),
  (
    'billing_notice',
    '標準 請求書送付案内',
    '【RGD】{{case_name}} 請求書のご送付',
    E'{{contact_name}} 様\n\nお世話になっております。株式会社グラストでございます。\n\n{{case_name}} にかかる請求書をお送りいたします。\n\n■ 請求番号: {{invoice_number}}\n■ 請求日: {{invoice_date}}\n■ 支払期限: {{due_date}}\n\nご確認の上、期限までにお支払いいただきますようお願い申し上げます。\n\nご不明点がございましたら、ご連絡ください。'
  )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 送信履歴 (sent_messages)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sent_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  template_id     UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  template_type   TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  sent_to         TEXT,            -- 送付先（メールアドレス or 名前）
  sent_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_method     TEXT NOT NULL DEFAULT 'manual',  -- email / manual / lark
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sent_messages_method_check CHECK (
    send_method IN ('email', 'manual', 'lark')
  )
);

COMMENT ON TABLE sent_messages IS '送信履歴';

CREATE INDEX IF NOT EXISTS idx_sent_messages_case_id       ON sent_messages (case_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_template_type ON sent_messages (template_type);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sent_at       ON sent_messages (sent_at);

-- ------------------------------------------------------------
-- 受理後タスクテンプレート（post_acceptance_processing）
-- ------------------------------------------------------------
INSERT INTO task_templates (trigger_status, title, description, priority, due_offset_days, sort_order) VALUES
  ('post_acceptance_processing', '開始案内を作成・送付する',
    '受理後の開始案内をテンプレートから作成し、顧客担当者に送付する',
    'high', 3, 10),
  ('post_acceptance_processing', '請求書を作成・送付する',
    '請求書を作成し、顧客担当者に送付する',
    'high', 5, 20),
  ('post_acceptance_processing', '証憑回収を依頼する',
    '必要証憑の一覧を顧客に送付し、回収を依頼する',
    'medium', 7, 30),
  ('post_acceptance_processing', 'LMS設定・アカウント発行を確認する',
    'LMS（研修システム）のアカウント発行・設定状況を確認する',
    'medium', 5, 40)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_messages     ENABLE ROW LEVEL SECURITY;

-- ---- invoices ----

CREATE POLICY invoices_select_internal ON invoices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY invoices_insert_internal ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY invoices_update_internal ON invoices
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
  );

-- ---- evidence_items ----

CREATE POLICY evidence_select_internal ON evidence_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY evidence_insert_internal ON evidence_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY evidence_update_internal ON evidence_items
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

-- ---- message_templates ----

CREATE POLICY msg_templates_select ON message_templates
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY msg_templates_insert ON message_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY msg_templates_update ON message_templates
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

-- ---- sent_messages ----

CREATE POLICY sent_messages_select ON sent_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY sent_messages_insert ON sent_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
  );
