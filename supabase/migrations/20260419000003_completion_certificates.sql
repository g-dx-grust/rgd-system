-- 修了証ファイル管理テーブル（案件単位）
CREATE TABLE IF NOT EXISTS case_completion_certificates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid        REFERENCES auth.users(id),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_completion_certs_case_id ON case_completion_certificates(case_id);

ALTER TABLE case_completion_certificates ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'completion-certificates',
  'completion-certificates',
  FALSE,
  104857600,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "completion_certificates_upload_internal" ON storage.objects;
CREATE POLICY "completion_certificates_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'completion-certificates'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "completion_certificates_select_internal" ON storage.objects;
CREATE POLICY "completion_certificates_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'completion-certificates'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "authenticated_read_completion_certs" ON case_completion_certificates;
CREATE POLICY "authenticated_read_completion_certs"
  ON case_completion_certificates FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "authenticated_manage_completion_certs" ON case_completion_certificates;
CREATE POLICY "authenticated_manage_completion_certs"
  ON case_completion_certificates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
