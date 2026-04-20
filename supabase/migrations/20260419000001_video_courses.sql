-- video_courses マスタ
CREATE TABLE IF NOT EXISTS video_courses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  is_active     boolean     NOT NULL DEFAULT true,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 案件×動画コース 中間テーブル
CREATE TABLE IF NOT EXISTS case_video_courses (
  case_id         uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  video_course_id uuid NOT NULL REFERENCES video_courses(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid REFERENCES auth.users(id),
  PRIMARY KEY (case_id, video_course_id)
);

CREATE INDEX IF NOT EXISTS idx_case_video_courses_case_id ON case_video_courses(case_id);

-- RLS
ALTER TABLE video_courses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_video_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_video_courses"
  ON video_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_case_video_courses"
  ON case_video_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_manage_case_video_courses"
  ON case_video_courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
