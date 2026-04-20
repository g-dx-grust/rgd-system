-- 請求書ファイル保管用カラム追加
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text;

CREATE INDEX IF NOT EXISTS idx_invoices_file_path
  ON invoices (file_path)
  WHERE file_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-files',
  'invoice-files',
  FALSE,
  104857600,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "invoice_files_upload_internal" ON storage.objects;
CREATE POLICY "invoice_files_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "invoice_files_select_internal" ON storage.objects;
CREATE POLICY "invoice_files_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );
