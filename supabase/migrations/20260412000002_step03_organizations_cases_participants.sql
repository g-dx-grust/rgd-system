-- ============================================================
-- Migration: Step 3 — マスタ管理・案件管理・受講者管理
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

INSERT INTO subsidy_programs (code, name, sort_order) VALUES
  ('jinzai_kaihatsu', '人材開発支援助成金',  10),
  ('it_jinzai',       'IT人材育成助成金',    20),
  ('kyariaappu',      'キャリアアップ助成金', 30)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 顧客企業テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_name        TEXT NOT NULL,
  corporate_number  TEXT,
  postal_code       TEXT,
  address           TEXT,
  industry          TEXT,
  employee_size     TEXT,       -- small / medium / large
  notes             TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS '顧客企業';

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_organizations_legal_name  ON organizations (legal_name);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at  ON organizations (deleted_at);

-- ------------------------------------------------------------
-- 顧客担当者テーブル
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
-- 案件テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  case_code                    TEXT NOT NULL UNIQUE,
  case_name                    TEXT NOT NULL,
  subsidy_program_id           UUID REFERENCES subsidy_programs(id) ON DELETE RESTRICT,
  status                       TEXT NOT NULL DEFAULT 'case_received',
  contract_date                DATE,
  planned_start_date           DATE,
  planned_end_date             DATE,
  pre_application_due_date     DATE,
  final_application_due_date   DATE,
  acceptance_date              DATE,
  owner_user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary                      TEXT,
  deleted_at                   TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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

COMMENT ON TABLE cases IS '案件（中心テーブル）';

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_cases_status             ON cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_organization_id   ON cases (organization_id);
CREATE INDEX IF NOT EXISTS idx_cases_owner_user_id     ON cases (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_planned_start     ON cases (planned_start_date);
CREATE INDEX IF NOT EXISTS idx_cases_pre_app_due       ON cases (pre_application_due_date);
CREATE INDEX IF NOT EXISTS idx_cases_final_app_due     ON cases (final_application_due_date);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at        ON cases (deleted_at);

-- ------------------------------------------------------------
-- 案件担当者テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'support',  -- owner / support / accounting
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (case_id, user_id)
);

COMMENT ON TABLE case_assignments IS '案件担当者';

CREATE INDEX IF NOT EXISTS idx_case_assignments_case_id  ON case_assignments (case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_user_id  ON case_assignments (user_id);

-- ------------------------------------------------------------
-- 受講者テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participants (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  employee_code    TEXT,
  name             TEXT NOT NULL,
  email            TEXT,
  department       TEXT,
  employment_type  TEXT,       -- regular / part_time / contract / dispatch
  joined_at        DATE,
  learner_status   TEXT NOT NULL DEFAULT 'planned',
  excluded_reason  TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT participants_learner_status_check CHECK (
    learner_status IN ('planned', 'active', 'completed', 'excluded')
  )
);

COMMENT ON TABLE participants IS '受講者（対象従業員）';

CREATE TRIGGER participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_participants_case_id       ON participants (case_id);
CREATE INDEX IF NOT EXISTS idx_participants_learner_status ON participants (learner_status);
CREATE INDEX IF NOT EXISTS idx_participants_deleted_at    ON participants (deleted_at);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE subsidy_programs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants          ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは助成金種別を参照可
CREATE POLICY subsidy_programs_select ON subsidy_programs
  FOR SELECT TO authenticated USING (active = TRUE);

-- 内部ユーザー（client_portal_user / external_specialist 以外）は全組織を参照可
CREATE POLICY organizations_select_internal ON organizations
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

-- 案件: 内部ユーザー参照（削除済み除く）
CREATE POLICY cases_select_internal ON cases
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

-- 顧客担当者: 自社案件のみ（client_portal_user 向け — Phase 2 で詳細化）
CREATE POLICY cases_select_client ON cases
  FOR SELECT TO authenticated
  USING (false);  -- Phase 2 で実装

-- 受講者: 内部ユーザー参照
CREATE POLICY participants_select_internal ON participants
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

-- 組織担当者: 内部ユーザー参照
CREATE POLICY org_contacts_select_internal ON organization_contacts
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

-- 案件担当者: 内部ユーザー参照
CREATE POLICY case_assignments_select_internal ON case_assignments
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
