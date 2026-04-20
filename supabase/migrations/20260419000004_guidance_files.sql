-- ご案内書ファイル管理テーブル
CREATE TABLE IF NOT EXISTS case_guidance_files (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid        REFERENCES auth.users(id),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_guidance_files_case_id ON case_guidance_files(case_id);

ALTER TABLE case_guidance_files ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guidance-files',
  'guidance-files',
  FALSE,
  104857600,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "guidance_files_upload_internal" ON storage.objects;
CREATE POLICY "guidance_files_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'guidance-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "guidance_files_select_internal" ON storage.objects;
CREATE POLICY "guidance_files_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'guidance-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "authenticated_read_guidance_files" ON case_guidance_files;
CREATE POLICY "authenticated_read_guidance_files"
  ON case_guidance_files FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "authenticated_manage_guidance_files" ON case_guidance_files;
CREATE POLICY "authenticated_manage_guidance_files"
  ON case_guidance_files FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
