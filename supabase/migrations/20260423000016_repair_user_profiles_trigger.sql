-- ============================================================
-- Migration: user_profiles 自動作成トリガーの補修
-- 作成日: 2026-04-23
-- 目的:
--   - auth.users 作成時の handle_new_user() を明示的に public schema で
--     実行させ、環境差で user_profiles の RLS に巻き込まれる事象を防ぐ
--   - trigger/function 定義を idempotent に再作成する
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id
    INTO default_role_id
    FROM public.roles
   WHERE code = 'operations_staff'
   LIMIT 1;

  INSERT INTO public.user_profiles (id, role_id, display_name, email)
  VALUES (
    NEW.id,
    default_role_id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
