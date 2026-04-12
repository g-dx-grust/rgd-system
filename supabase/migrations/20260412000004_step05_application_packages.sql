-- ============================================================
-- Migration: Step 5 — 初回申請対応・社労士連携
-- 作成日: 2026-04-12
-- Step: 5 初回申請対応・社労士連携
-- ============================================================

-- ------------------------------------------------------------
-- 申請連携パッケージ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_packages (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                 UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  package_type            TEXT NOT NULL,          -- pre / final
  package_status          TEXT NOT NULL DEFAULT 'draft',  -- draft / shared / archived
  generated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_file_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  shared_to               TEXT,                   -- 共有先（社労士名・メール等）
  shared_at               TIMESTAMPTZ,
  note                    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT application_packages_type_check CHECK (
    package_type IN ('pre', 'final')
  ),
  CONSTRAINT application_packages_status_check CHECK (
    package_status IN ('draft', 'shared', 'archived')
  )
);

COMMENT ON TABLE application_packages IS '申請連携パッケージ（初回 / 最終）';

CREATE TRIGGER application_packages_updated_at
  BEFORE UPDATE ON application_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_app_pkg_case_id       ON application_packages (case_id);
CREATE INDEX IF NOT EXISTS idx_app_pkg_type          ON application_packages (package_type);
CREATE INDEX IF NOT EXISTS idx_app_pkg_status        ON application_packages (package_status);
CREATE INDEX IF NOT EXISTS idx_app_pkg_generated_by  ON application_packages (generated_by);

-- ------------------------------------------------------------
-- パッケージ内アイテム（含めたファイル / CSV / メモ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_package_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id          UUID NOT NULL REFERENCES application_packages(id) ON DELETE CASCADE,
  document_id         UUID REFERENCES documents(id) ON DELETE SET NULL,
  snapshot_version_no INTEGER,
  item_type           TEXT NOT NULL DEFAULT 'file',  -- file / csv / pdf / note
  label               TEXT,    -- 表示名（任意）
  note                TEXT,    -- メモ（item_type = 'note' の本文も兼ねる）
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT app_pkg_items_type_check CHECK (
    item_type IN ('file', 'csv', 'pdf', 'note')
  )
);

COMMENT ON TABLE application_package_items IS 'パッケージに含まれるファイル / データ';

CREATE INDEX IF NOT EXISTS idx_app_pkg_items_package_id  ON application_package_items (package_id);
CREATE INDEX IF NOT EXISTS idx_app_pkg_items_document_id ON application_package_items (document_id);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE application_packages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_package_items ENABLE ROW LEVEL SECURITY;

-- 申請パッケージ: 内部ユーザー参照
CREATE POLICY app_packages_select_internal ON application_packages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user')
        AND up.deleted_at IS NULL
    )
  );

-- 申請パッケージ: 作成（ops / admin のみ）
CREATE POLICY app_packages_insert_internal ON application_packages
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

-- 申請パッケージ: 更新（ops / admin のみ）
CREATE POLICY app_packages_update_internal ON application_packages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

-- パッケージアイテム: 内部ユーザー参照
CREATE POLICY app_pkg_items_select_internal ON application_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user')
        AND up.deleted_at IS NULL
    )
  );

-- パッケージアイテム: 作成
CREATE POLICY app_pkg_items_insert_internal ON application_package_items
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

-- パッケージアイテム: 削除（draft 段階のみ想定、ops / admin）
CREATE POLICY app_pkg_items_delete_internal ON application_package_items
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

-- external_specialist: 共有済みパッケージのみ参照可
CREATE POLICY app_packages_select_specialist ON application_packages
  FOR SELECT TO authenticated
  USING (
    package_status = 'shared'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'external_specialist'
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY app_pkg_items_select_specialist ON application_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_packages ap
      WHERE ap.id = package_id
        AND ap.package_status = 'shared'
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'external_specialist'
        AND up.deleted_at IS NULL
    )
  );
