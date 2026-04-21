import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  isVideoCoursesFeatureAvailable,
  listVideoCoursesAdmin,
} from "@/server/repositories/video-courses";
import { listSubsidyPrograms } from "@/server/repositories/subsidy-programs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormActionButton } from "@/components/ui";
import { CourseFormTrigger } from "./CourseFormDialog";
import { CourseToggleButton } from "./CourseToggleButton";
import type { Metadata } from "next";
import { getOptionalFeatureUnavailableMessage } from "@/lib/supabase/errors";
import { deleteCourseAction } from "@/server/usecases/courses/actions";

export const metadata: Metadata = {
  title: "コースマスタ管理 | RGDシステム",
};

export default async function CoursesPage() {
  const currentUser = await getCurrentUserProfile();

  if (!currentUser || !can(currentUser.roleCode, PERMISSIONS.USER_MANAGE)) {
    redirect("/dashboard");
  }

  const [courses, subsidyPrograms, isVideoCoursesAvailable] = await Promise.all([
    listVideoCoursesAdmin(),
    listSubsidyPrograms(false),
    isVideoCoursesFeatureAvailable(),
  ]);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
            コースマスタ管理
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            案件登録プルダウンで使用するコース一覧を管理します
          </p>
        </div>
        {isVideoCoursesAvailable ? (
          <CourseFormTrigger subsidyPrograms={subsidyPrograms} />
        ) : null}
      </div>

      {!isVideoCoursesAvailable ? (
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            {getOptionalFeatureUnavailableMessage("コースマスタ")}
          </p>
        </Card>
      ) : null}

      {/* テーブル */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                コース名
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[60px]">
                略称
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[220px]">
                助成金種別
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[60px]">
                順序
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[70px]">
                状態
              </th>
              <th className="text-right text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[160px]">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr
                key={course.id}
                className={[
                  "border-b border-[var(--color-border)] last:border-0",
                  "hover:bg-[var(--color-bg-secondary)]",
                  !course.isActive ? "opacity-50" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-text)]">
                    {course.name}
                  </p>
                  {course.description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                      {course.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-sub)]">
                  {course.code ?? (
                    <span className="text-[var(--color-text-muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-sub)]">
                  {course.subsidyProgramName ?? (
                    <span className="text-[var(--color-text-muted)]">未設定</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-sub)] text-center">
                  {course.displayOrder}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={course.isActive ? "success" : "default"}>
                    {course.isActive ? "有効" : "無効"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <CourseFormTrigger
                      course={course}
                      subsidyPrograms={subsidyPrograms}
                    />
                    <FormActionButton
                      action={deleteCourseAction}
                      fields={{ id: course.id }}
                      label="削除"
                      pendingLabel="削除中..."
                      confirmMessage={`コース「${course.name}」を削除しますか？`}
                    />
                    <CourseToggleButton
                      courseId={course.id}
                      isActive={course.isActive}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!isVideoCoursesAvailable && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]"
                >
                  {getOptionalFeatureUnavailableMessage("コースマスタ")}
                </td>
              </tr>
            )}
            {isVideoCoursesAvailable && courses.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]"
                >
                  コースが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-[var(--color-text-muted)]">
        全 {courses.length} 件（有効: {courses.filter((c) => c.isActive).length} 件）
      </p>
    </div>
  );
}
