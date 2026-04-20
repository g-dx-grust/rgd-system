-- タスク手動管理用の RLS 調整
DROP POLICY IF EXISTS tasks_insert_ops ON tasks;
CREATE POLICY tasks_insert_ops ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN (
          'admin',
          'operations_manager',
          'operations_staff',
          'sales',
          'accounting'
        )
        AND up.deleted_at IS NULL
    )
  );
