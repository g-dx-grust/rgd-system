-- ============================================================
-- Migration: cases SELECT ポリシーを「自社案件のみ」に補正
-- 作成日:   2026-04-20
-- 背景:     20260419000007_rls_operating_company.sql では
--           Operations Staff / Sales / Accounting に対して
--           owner / case_assignments 条件まで課していたため、
--           指示書④「自社案件のみ閲覧可」より厳しくなっていた。
-- 方針:     一般スタッフは自社案件を閲覧可。
--           上位ロール（operating_company_id IS NULL）は両社横断可。
-- ============================================================

DROP POLICY IF EXISTS cases_select_company ON cases;

CREATE POLICY cases_select_company ON cases
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

COMMENT ON POLICY cases_select_company ON cases
  IS '内部ユーザーは自社案件のみ閲覧可。operating_company_id IS NULL の上位ロールは両社横断可。';
