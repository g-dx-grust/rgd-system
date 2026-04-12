-- ============================================================
-- Migration: upload_token_id カラムを documents テーブルに追加
-- 作成日: 2026-04-12
-- 目的: 外部提出トークン経由のアップロード元を記録する。
--       uploaded_by_user_id（UUID FK）にトークン文字列を入れていた
--       FK 制約違反を解消するための修正。
-- ============================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS upload_token_id UUID
    REFERENCES upload_tokens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_upload_token_id
  ON documents (upload_token_id);

COMMENT ON COLUMN documents.upload_token_id IS
  '外部提出トークン経由アップロードの場合に upload_tokens.id を記録する。内部ユーザーアップロードの場合は NULL。';
