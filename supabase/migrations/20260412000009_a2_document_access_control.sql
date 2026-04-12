-- ============================================================
-- Migration: A-2 書類閲覧の案件単位権限チェック
-- 作成日: 2026-04-12
-- フェーズ: A-2 (FIX_INSTRUCTIONS.md)
-- ============================================================

-- ------------------------------------------------------------
-- user_profiles に organization_id を追加
-- 顧客担当者 (client_portal_user) / 社労士等 (external_specialist) が
-- 自組織案件のみアクセスできるよう紐付けるために使用する。
-- 内部ユーザーは NULL で運用。
-- ------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id ON user_profiles (organization_id);

-- ------------------------------------------------------------
-- documents: 顧客担当者向け参照 RLS ポリシーを追加
-- 既存の documents_select_internal は内部ユーザー専用のため、
-- client_portal_user はこのポリシーで自組織書類のみ参照可能にする。
-- ------------------------------------------------------------
CREATE POLICY documents_select_client ON documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'client_portal_user'
        AND up.organization_id = documents.organization_id
        AND up.deleted_at IS NULL
    )
  );
