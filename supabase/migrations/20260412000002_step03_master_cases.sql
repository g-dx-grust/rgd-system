-- ============================================================
-- Migration: Step 3 — マスタ管理・案件管理
-- 作成日: 2026-04-12
-- Step: 3 マスタ管理・案件管理
-- ============================================================

-- ------------------------------------------------------------
-- 助成金種別マスタ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subsidy_programs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subsidy_programs IS '助成金種別マスタ';

CREATE TRIGGER subsidy_programs_updated_at
  BEFORE UPDATE ON subsidy_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 初期データ
INSERT INTO subsidy_programs (code, name, sort_order) VALUES
  ('jinzai_kaihatsu', '人材開発支援助成金（特定訓練コース）', 10),
  ('jinzai_kaihatsu_ippan', '人材開発支援助成金（一般訓練コース）', 20),
  ('kyoiku_kunren', '教育訓練給付（特定一般教育訓練）', 30),
  ('other', 'その他', 99)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 顧客企業マスタ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_name       TEXT NOT NULL,
  corporate_number TEXT,
  postal_code      TEXT,
  address          TEXT,
  industry         TEXT,
  employee_size    TEXT,  -- '1-9', '10-49', '50-99', '100-299', '300+'
  notes            TEXT,
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS '顧客企業マスタ';

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_organizations_legal_name ON organizations (legal_name);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 顧客担当者
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  department      TEXT,
  title           TEXT,
  email           TEXT,
  phone           TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organization_contacts IS '顧客担当者';

CREATE TRIGGER organization_contacts_updated_at
  BEFORE UPDATE ON organization_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_contacts_org_id ON organization_contacts (organization_id);

-- ------------------------------------------------------------
-- 案件コード採番シーケンス
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS cases_code_seq START 1;

-- ------------------------------------------------------------
-- 案件テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_code                 TEXT NOT NULL UNIQUE DEFAULT (
    'RGD-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYYYMM') || '-' ||
    LPAD(NEXTVAL('cases_code_seq')::TEXT, 4, '0')
  ),
  organization_id           UUID NOT NULL REFERENCES organizations(id),
  case_name                 TEXT NOT NULL,
  subsidy_program_id        UUID REFERENCES subsidy_programs(id),
  status                    TEXT NOT NULL DEFAULT 'case_received',
  contract_date             DATE,
  planned_start_date        DATE,
  planned_end_date          DATE,
  pre_application_due_date  DATE,
  final_application_due_date DATE,
  acceptance_date           DATE,
  owner_user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary                   TEXT,
  deleted_at                TIMESTAMPTZ,
  created_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cases_status_check CHECK (status IN (
    'case_received',
    'initial_guide_pending',
    'doc_collecting',
    'pre_application_ready',
    'pre_application_shared',
    'labor_office_waiting',
    'post_acceptance_processing',
    'training_in_progress',
    'completion_preparing',
    'final_reviewing',
    'final_application_shared',
    'completed',
    'on_hold',
    'returned',
    'cancelled'
  ))
);

COMMENT ON TABLE cases IS '案件テーブル（中心テーブル）';

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_cases_status           ON cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_owner_user_id    ON cases (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_organization_id  ON cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_planned_start    ON cases (planned_start_date);
CREATE INDEX IF NOT EXISTS idx_cases_pre_app_due      ON cases (pre_application_due_date);
CREATE INDEX IF NOT EXISTS idx_cases_final_app_due    ON cases (final_application_due_date);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at       ON cases (deleted_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 案件担当者（アサインメント）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'support',  -- owner / support / accounting
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (case_id, user_id)
);

COMMENT ON TABLE case_assignments IS '案件担当者アサインメント';

CREATE INDEX IF NOT EXISTS idx_case_assignments_case_id ON case_assignments (case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_user_id ON case_assignments (user_id);

-- ------------------------------------------------------------
-- 受講者テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  employee_code    TEXT,
  name             TEXT NOT NULL,
  name_kana        TEXT,
  email            TEXT,
  department       TEXT,
  employment_type  TEXT,  -- regular / part_time / contract / dispatch
  joined_at        DATE,
  learner_status   TEXT NOT NULL DEFAULT 'planned',  -- planned / active / completed / excluded
  excluded_reason  TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT participants_learner_status_check CHECK (learner_status IN (
    'planned', 'active', 'completed', 'excluded'
  ))
);

COMMENT ON TABLE participants IS '受講者（対象従業員）';

CREATE TRIGGER participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_participants_case_id       ON participants (case_id);
CREATE INDEX IF NOT EXISTS idx_participants_learner_status ON participants (learner_status);

-- ------------------------------------------------------------
-- タスクテンプレート（初期タスク自動生成用）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_status TEXT NOT NULL,  -- このステータスに遷移した時に生成
  title        TEXT NOT NULL,
  description  TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium',  -- low / medium / high / critical
  due_offset_days INTEGER,  -- 作成日から何日後を期限とするか
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE task_templates IS 'タスク自動生成テンプレート';

-- 案件受領時（case_received）に生成するタスク
INSERT INTO task_templates (trigger_status, title, description, priority, due_offset_days, sort_order) VALUES
  ('case_received', '顧客担当者を確認・登録する', '顧客企業の窓口担当者が登録されているか確認する', 'high', 3, 10),
  ('case_received', '助成金種別・研修プランを確定する', '案件に適用する助成金種別とコースを確定する', 'high', 3, 20),
  ('case_received', '担当者をアサインする', 'Ops担当・営業担当を案件にアサインする', 'high', 1, 30),
  ('case_received', '初期案内を作成する', '顧客への初期案内資料・メールを準備する', 'medium', 7, 40)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- タスクテーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  task_template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'open',  -- open / in_progress / done / skipped
  priority         TEXT NOT NULL DEFAULT 'medium', -- low / medium / high / critical
  assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date         DATE,
  generated_by_rule TEXT,  -- 自動生成ルール識別子
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tasks_status_check CHECK (status IN ('open', 'in_progress', 'done', 'skipped')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

COMMENT ON TABLE tasks IS '案件タスク';

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_case_id        ON tasks (case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee        ON tasks (assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date        ON tasks (due_date);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE subsidy_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;

-- subsidy_programs: 認証済みは参照可（内部ユーザーのみ）
CREATE POLICY subsidy_programs_select ON subsidy_programs
  FOR SELECT TO authenticated USING (true);

-- organizations: 内部ユーザー（非顧客・非社労士）は全件参照可
CREATE POLICY organizations_select_internal ON organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- organizations: admin / ops_manager / ops_staff / sales が作成・更新可
CREATE POLICY organizations_insert_internal ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY organizations_update_internal ON organizations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- organization_contacts: organizations と同様のポリシー
CREATE POLICY org_contacts_select_internal ON organization_contacts
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

CREATE POLICY org_contacts_insert_internal ON organization_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY org_contacts_update_internal ON organization_contacts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- cases: auditor / admin / ops は全件参照、sales / accounting / ops_staff は自担当のみ
CREATE POLICY cases_select_all_roles ON cases
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      -- 全件参照ロール
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN roles r ON r.id = up.role_id
        WHERE up.id = auth.uid()
          AND r.code IN ('admin', 'operations_manager', 'auditor')
          AND up.deleted_at IS NULL
      )
      OR
      -- 自担当のみ
      (
        EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON r.id = up.role_id
          WHERE up.id = auth.uid()
            AND r.code IN ('operations_staff', 'sales', 'accounting')
            AND up.deleted_at IS NULL
        )
        AND (
          owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM case_assignments ca
            WHERE ca.case_id = cases.id AND ca.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY cases_insert_ops ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY cases_update_ops ON cases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- case_assignments
CREATE POLICY case_assignments_select ON case_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY case_assignments_insert_ops ON case_assignments
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

CREATE POLICY case_assignments_delete_ops ON case_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

-- participants: 内部ユーザーは参照可
CREATE POLICY participants_select_internal ON participants
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY participants_insert_ops ON participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY participants_update_ops ON participants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- task_templates: 内部ユーザーは参照可
CREATE POLICY task_templates_select ON task_templates
  FOR SELECT TO authenticated USING (true);

-- tasks: 案件が参照できるユーザーは tasks も参照可
CREATE POLICY tasks_select_internal ON tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
    )
  );

CREATE POLICY tasks_insert_ops ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY tasks_update_ops ON tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales', 'accounting')
        AND up.deleted_at IS NULL
    )
  );
