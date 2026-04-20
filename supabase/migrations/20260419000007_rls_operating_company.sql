-- ============================================================
-- Migration: 運営会社スコープ RLS ポリシー
-- 作成日:   2026-04-19
-- 前提:     20260419000006_operating_companies.sql 完了済み
--           (operating_companies, cases.operating_company_id,
--            user_profiles.operating_company_id が存在すること)
-- 確定:     両社横断可 = Admin / Operations Manager / Auditor
--           自社限定   = Operations Staff / Sales / Accounting
--           規則:       user_profiles.operating_company_id IS NULL
--                       → 上位ロール（両社横断）
--                       user_profiles.operating_company_id IS NOT NULL
--                       → 自社案件のみ
-- ============================================================

-- ------------------------------------------------------------
-- ヘルパー関数: 運営会社アクセス可否判定
--   NULL operating_company_id = 上位ロール（両社横断可）
--   非 NULL = 自社の案件のみアクセス可
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_can_access_company(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.deleted_at IS NULL
      AND (
        up.operating_company_id IS NULL
        OR up.operating_company_id = p_company_id
      )
  )
$$;

COMMENT ON FUNCTION auth_can_access_company(UUID)
  IS '認証ユーザーが指定運営会社の案件にアクセス可能か判定。'
     'operating_company_id IS NULL (Admin / Ops Manager / Auditor 等) は全社横断可。';

-- ============================================================
-- cases テーブル
-- ============================================================

DROP POLICY IF EXISTS cases_select_internal    ON cases;
DROP POLICY IF EXISTS cases_select_all_roles   ON cases;
DROP POLICY IF EXISTS cases_insert_ops         ON cases;
DROP POLICY IF EXISTS cases_update_ops         ON cases;
-- cases_select_client は USING(false) のまま残す（Phase 2 で実装）

-- SELECT: 内部ユーザー + 運営会社スコープ
--   上位ロール (operating_company_id IS NULL) → 全社横断・全件参照
--   一般スタッフ                              → 自社 + 担当案件のみ
CREATE POLICY cases_select_company ON cases
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND (
      -- 全件参照ロール（両社横断想定ロール）
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN roles r ON r.id = up.role_id
        WHERE up.id = auth.uid()
          AND r.code IN ('admin', 'operations_manager', 'auditor')
          AND up.deleted_at IS NULL
      )
      OR
      -- 自担当案件のみ
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

-- INSERT: ops ロール + 自社のみ
CREATE POLICY cases_insert_company ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- UPDATE: ops ロール + 自社のみ
CREATE POLICY cases_update_company ON cases
  FOR UPDATE TO authenticated
  USING (
    auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- ============================================================
-- participants テーブル（case_id 経由でスコープ判定）
-- ============================================================

DROP POLICY IF EXISTS participants_select_internal ON participants;
DROP POLICY IF EXISTS participants_insert_ops       ON participants;
DROP POLICY IF EXISTS participants_update_ops       ON participants;

CREATE POLICY participants_select_company ON participants
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = participants.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY participants_insert_company ON participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = participants.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY participants_update_company ON participants
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = participants.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- document_requirements テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS doc_req_select_internal ON document_requirements;
DROP POLICY IF EXISTS doc_req_insert_internal ON document_requirements;
DROP POLICY IF EXISTS doc_req_update_internal ON document_requirements;

CREATE POLICY doc_req_select_company ON document_requirements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requirements.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY doc_req_insert_company ON document_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requirements.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY doc_req_update_company ON document_requirements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requirements.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- documents テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS documents_select_internal ON documents;
DROP POLICY IF EXISTS documents_insert_internal ON documents;
DROP POLICY IF EXISTS documents_update_internal ON documents;
-- documents_select_client (a2 migration) はそのまま残す

CREATE POLICY documents_select_company ON documents
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY documents_insert_company ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY documents_update_company ON documents
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- upload_tokens テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS upload_tokens_select_internal ON upload_tokens;
DROP POLICY IF EXISTS upload_tokens_insert_internal ON upload_tokens;

CREATE POLICY upload_tokens_select_company ON upload_tokens
  FOR SELECT TO authenticated
  USING (
    expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = upload_tokens.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY upload_tokens_insert_company ON upload_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = upload_tokens.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- application_packages テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS app_packages_select_internal ON application_packages;
DROP POLICY IF EXISTS app_packages_insert_internal ON application_packages;
DROP POLICY IF EXISTS app_packages_update_internal ON application_packages;
-- app_packages_select_specialist はそのまま残す（外部専門家は別軸での制御）

CREATE POLICY app_packages_select_company ON application_packages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = application_packages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_packages_insert_company ON application_packages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = application_packages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_packages_update_company ON application_packages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = application_packages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- application_package_items テーブル（package_id → case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS app_pkg_items_select_internal ON application_package_items;
DROP POLICY IF EXISTS app_pkg_items_insert_internal ON application_package_items;
DROP POLICY IF EXISTS app_pkg_items_delete_internal ON application_package_items;
-- app_pkg_items_select_specialist はそのまま残す

CREATE POLICY app_pkg_items_select_company ON application_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM application_packages ap
      JOIN cases c ON c.id = ap.case_id
      WHERE ap.id = application_package_items.package_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_pkg_items_insert_company ON application_package_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM application_packages ap
      JOIN cases c ON c.id = ap.case_id
      WHERE ap.id = application_package_items.package_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_pkg_items_delete_company ON application_package_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM application_packages ap
      JOIN cases c ON c.id = ap.case_id
      WHERE ap.id = application_package_items.package_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- invoices テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS invoices_select_internal ON invoices;
DROP POLICY IF EXISTS invoices_insert_internal ON invoices;
DROP POLICY IF EXISTS invoices_update_internal ON invoices;

CREATE POLICY invoices_select_company ON invoices
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = invoices.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY invoices_insert_company ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = invoices.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY invoices_update_company ON invoices
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = invoices.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- evidence_items テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS evidence_select_internal ON evidence_items;
DROP POLICY IF EXISTS evidence_insert_internal ON evidence_items;
DROP POLICY IF EXISTS evidence_update_internal ON evidence_items;

CREATE POLICY evidence_select_company ON evidence_items
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = evidence_items.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY evidence_insert_company ON evidence_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = evidence_items.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY evidence_update_company ON evidence_items
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = evidence_items.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- sent_messages テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS sent_messages_select ON sent_messages;
DROP POLICY IF EXISTS sent_messages_insert ON sent_messages;

CREATE POLICY sent_messages_select_company ON sent_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = sent_messages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY sent_messages_insert_company ON sent_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = sent_messages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- tasks テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS tasks_select_internal ON tasks;
DROP POLICY IF EXISTS tasks_insert_ops       ON tasks;
DROP POLICY IF EXISTS tasks_update_ops       ON tasks;

CREATE POLICY tasks_select_company ON tasks
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY tasks_insert_company ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY tasks_update_company ON tasks
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
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- case_assignments テーブル（case_id 経由）
-- ============================================================
-- case_assignments_select (USING true) と
-- case_assignments_select_internal の両方を置換

DROP POLICY IF EXISTS case_assignments_select          ON case_assignments;
DROP POLICY IF EXISTS case_assignments_select_internal ON case_assignments;

CREATE POLICY case_assignments_select_company ON case_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_assignments.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );
