-- ============================================================
-- Migration: C-1 — チェックリスト・書類テンプレートマスタ
-- 作成日: 2026-04-12
-- 対応: FIX_INSTRUCTIONS.md C-1
-- ============================================================

-- ------------------------------------------------------------
-- チェックリストテンプレート（フェーズ × 助成金種別）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  phase               TEXT NOT NULL,       -- pre_application / final_application
  subsidy_program_id  UUID REFERENCES subsidy_programs(id) ON DELETE CASCADE,
  -- NULL = 全助成金種別共通
  sort_order          INTEGER NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT checklist_templates_phase_check CHECK (
    phase IN ('pre_application', 'final_application')
  )
);

COMMENT ON TABLE checklist_templates IS 'チェックリストテンプレート定義（フェーズ × 助成金種別）';

CREATE INDEX IF NOT EXISTS idx_checklist_templates_phase
  ON checklist_templates (phase);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_subsidy
  ON checklist_templates (subsidy_program_id);

-- ------------------------------------------------------------
-- チェックリストテンプレート項目
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  required        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE checklist_template_items IS 'チェックリストテンプレートの各項目';

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template
  ON checklist_template_items (template_id);

-- ------------------------------------------------------------
-- 案件ごとのチェックリスト項目（テンプレートから展開）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checklist_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                 UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  template_item_id        UUID REFERENCES checklist_template_items(id) ON DELETE SET NULL,
  phase                   TEXT NOT NULL,
  label                   TEXT NOT NULL,
  required                BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  checked                 BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at              TIMESTAMPTZ,
  checked_by_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT checklist_items_phase_check CHECK (
    phase IN ('pre_application', 'final_application')
  )
);

COMMENT ON TABLE checklist_items IS '案件ごとのチェックリスト項目（テンプレートから展開）';

CREATE TRIGGER checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_checklist_items_case_id
  ON checklist_items (case_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_phase
  ON checklist_items (case_id, phase);

-- ------------------------------------------------------------
-- 書類要件テンプレート（助成金種別 × 書類種別）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_requirement_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subsidy_program_id  UUID REFERENCES subsidy_programs(id) ON DELETE CASCADE,
  -- NULL = 全助成金種別共通
  document_type_id    UUID NOT NULL REFERENCES document_types(id) ON DELETE CASCADE,
  scope               TEXT NOT NULL DEFAULT 'company', -- company / participant
  required_flag       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT doc_req_templates_scope_check CHECK (scope IN ('company', 'participant')),
  UNIQUE (subsidy_program_id, document_type_id)
);

COMMENT ON TABLE document_requirement_templates IS '書類要件テンプレート（助成金種別 × 書類種別）';

CREATE INDEX IF NOT EXISTS idx_doc_req_templates_subsidy
  ON document_requirement_templates (subsidy_program_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_templates_scope
  ON document_requirement_templates (scope);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE checklist_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirement_templates ENABLE ROW LEVEL SECURITY;

-- checklist_templates: 認証済み内部ユーザーは参照可
CREATE POLICY checklist_templates_select ON checklist_templates
  FOR SELECT TO authenticated USING (true);

-- checklist_template_items: 認証済み内部ユーザーは参照可
CREATE POLICY checklist_template_items_select ON checklist_template_items
  FOR SELECT TO authenticated USING (true);

-- checklist_items: 案件が参照できるユーザーは参照可
CREATE POLICY checklist_items_select ON checklist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases c WHERE c.id = checklist_items.case_id
    )
  );

CREATE POLICY checklist_items_update_ops ON checklist_items
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

CREATE POLICY checklist_items_insert_ops ON checklist_items
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

-- document_requirement_templates: 認証済みは参照可
CREATE POLICY doc_req_templates_select ON document_requirement_templates
  FOR SELECT TO authenticated USING (true);
