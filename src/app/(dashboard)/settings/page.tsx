import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { listUsers, listRoles } from "@/server/repositories/users";
import {
  isVideoCoursesFeatureAvailable,
  listVideoCoursesAdmin,
} from "@/server/repositories/video-courses";
import { listSubsidyPrograms } from "@/server/repositories/subsidy-programs";
import { listOperatingCompanies } from "@/server/repositories/operating-companies";
import { CreateUserForm } from "@/app/(dashboard)/admin/users/CreateUserForm";
import { CourseFormTrigger } from "@/app/(dashboard)/admin/courses/CourseFormDialog";
import { SubsidyProgramForm } from "./SubsidyProgramForm";
import { Badge, ButtonLink, Card, FormActionButton } from "@/components/ui";
import { getOptionalFeatureUnavailableMessage } from "@/lib/supabase/errors";
import { deleteSubsidyProgramAction } from "@/server/usecases/subsidy-programs/actions";
import { deleteCourseAction } from "@/server/usecases/courses/actions";

export const metadata = {
  title: "設定 | RGDシステム",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function formatLastLogin(dateStr: string | null): string {
  if (!dateStr) return "未ログイン";
  return new Date(dateStr).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default async function SettingsPage() {
  const user = await getCurrentUserProfile();

  if (!can(user?.roleCode, PERMISSIONS.SETTINGS_EDIT)) {
    redirect("/dashboard");
  }

  const canManageUsers = can(user?.roleCode, PERMISSIONS.USER_MANAGE);

  const [users, courses, subsidyPrograms, roles, operatingCompanies, isVideoCoursesAvailable] = await Promise.all([
    listUsers(),
    listVideoCoursesAdmin(),
    listSubsidyPrograms(false),
    canManageUsers ? listRoles() : Promise.resolve([]),
    listOperatingCompanies(),
    isVideoCoursesFeatureAvailable(),
  ]);

  const activeUsers = users.filter((entry) => entry.isActive).length;
  const inactiveUsers = users.length - activeUsers;
  const unmanagedUsers = users.filter((entry) => !entry.hasProfile).length;
  const activeCourses = courses.filter((entry) => entry.isActive).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">設定</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          ユーザー管理と案件登録マスタをここからまとめて操作できます。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SummaryCard
          label="有効ユーザー"
          value={`${activeUsers}名`}
          sublabel={
            unmanagedUsers > 0
              ? `未追加 ${unmanagedUsers}名`
              : inactiveUsers > 0
                ? `停止中 ${inactiveUsers}名`
                : "全員有効"
          }
        />
        <SummaryCard
          label="有効コース"
          value={`${activeCourses}件`}
          sublabel={`全 ${courses.length}件`}
        />
        <SummaryCard
          label="助成金種別"
          value={`${subsidyPrograms.length}件`}
          sublabel="案件登録プルダウンで使用"
        />
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">ユーザー管理</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              アカウントの追加、ロール付与、所属運営会社の管理を行います。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageUsers ? (
              <CreateUserForm roles={roles} operatingCompanies={operatingCompanies} />
            ) : null}
            <ButtonLink href="/admin/users" variant="secondary">
              詳細管理を開く
            </ButtonLink>
          </div>
        </div>

        {!canManageUsers ? (
          <Card className="p-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              ユーザーの追加・変更は Admin 権限で利用できます。
            </p>
          </Card>
        ) : null}

        <Card className="overflow-hidden p-0">
          {users.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              ユーザーが登録されていません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      氏名 / メール
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      ロール
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      所属運営会社
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      最終ログイン
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      状態
                    </th>
                    {canManageUsers && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {users.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text)]">{entry.displayName}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{entry.email}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-sub)]">
                        {entry.hasProfile ? (entry.roleLabel || entry.roleCode) : "未追加"}
                      </td>
                      <td className="px-4 py-3">
                        {entry.operatingCompanyName ? (
                          <Badge
                            variant={
                              entry.operatingCompanyName.includes("グラスト")
                                ? "accent"
                                : "default"
                            }
                          >
                            {entry.operatingCompanyName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-[var(--color-text-muted)]">横断可</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                        {formatLastLogin(entry.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={!entry.hasProfile ? "warning" : entry.isActive ? "success" : "default"}
                        >
                          {!entry.hasProfile ? "要設定" : entry.isActive ? "有効" : "停止中"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text)]">運営会社</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                会社横断ログインか、株式会社グラスト / 株式会社エイムの片方利用かをここで判断します。
                DB未反映の環境では固定マスタを表示しています。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {operatingCompanies.map((company) => (
                <Badge key={company.id} variant={company.code === "GRUST" ? "accent" : "default"}>
                  {company.name}
                </Badge>
              ))}
              {operatingCompanies.length === 0 ? (
                <span className="text-xs text-[var(--color-text-muted)]">
                  運営会社マスタを読み込めませんでした。
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">各種マスタ登録</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              案件追加時のプルダウンに使う助成金種別とコースをここで管理します。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageUsers ? <SubsidyProgramForm /> : null}
            {canManageUsers && isVideoCoursesAvailable ? (
              <CourseFormTrigger subsidyPrograms={subsidyPrograms} />
            ) : null}
            <ButtonLink href="/admin/courses" variant="secondary">
              コース管理を開く
            </ButtonLink>
          </div>
        </div>

        {!isVideoCoursesAvailable ? (
          <Card className="p-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              {getOptionalFeatureUnavailableMessage("コースマスタ")}
            </p>
          </Card>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">助成金種別</h3>
          </div>
          {subsidyPrograms.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              助成金種別が登録されていません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      助成金名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      略称
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      状態
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {subsidyPrograms.map((program) => (
                    <tr key={program.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text)]">{program.name}</p>
                        {program.description ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {program.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-sub)]">
                        {program.abbreviation ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={program.active ? "success" : "default"}>
                          {program.active ? "有効" : "無効"}
                        </Badge>
                      </td>
                      {canManageUsers && (
                        <td className="px-4 py-3">
                          <FormActionButton
                            action={deleteSubsidyProgramAction}
                            fields={{ id: program.id }}
                            label="削除"
                            pendingLabel="削除中..."
                            confirmMessage={`助成金種別「${program.name}」を削除しますか？`}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          {!isVideoCoursesAvailable ? (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              {getOptionalFeatureUnavailableMessage("コースマスタ")}
            </div>
          ) : courses.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              コースが登録されていません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      コース名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      助成金種別
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      略称
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      状態
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                      更新日
                    </th>
                    {canManageUsers && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                        操作
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text)]">{course.name}</p>
                        {course.displayTemplate ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {course.displayTemplate}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-sub)]">
                        {course.subsidyProgramName ?? "未設定"}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-sub)]">
                        {course.code ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={course.isActive ? "success" : "default"}>
                          {course.isActive ? "有効" : "無効"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                        {formatDate(course.updatedAt)}
                      </td>
                      {canManageUsers && (
                        <td className="px-4 py-3">
                          <FormActionButton
                            action={deleteCourseAction}
                            fields={{ id: course.id }}
                            label="削除"
                            pendingLabel="削除中..."
                            confirmMessage={`コース「${course.name}」を削除しますか？`}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="text-2xl font-semibold text-[var(--color-text)]">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{sublabel}</p>
    </Card>
  );
}
