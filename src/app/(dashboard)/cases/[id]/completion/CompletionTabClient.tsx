"use client";

/**
 * 終了申請準備タブ — クライアントコンポーネント
 *
 * アンケート回収・チェックリスト確認・最終申請パッケージ作成・
 * 完了遷移をインタラクティブに操作する。
 */

import { useState, useTransition } from "react";
import {
  SURVEY_STATUS_LABELS,
  SURVEY_TYPE_LABELS,
  FINAL_REVIEW_ITEM_TYPE_LABELS,
} from "@/types/surveys";
import type {
  Survey,
  SurveyStatus,
  FinalReviewItem,
  FinalSpecialistLinkage,
  FinalReadinessResult,
} from "@/types/surveys";
import type { ApplicationPackage } from "@/types/application-packages";
import type { SpecialistUserOption } from "@/server/repositories/users";
import {
  updateSurveyStatusAction,
  deleteSurveyAction,
  toggleFinalReviewItemAction,
  recordFinalSpecialistLinkageAction,
  completeCaseAction,
} from "@/server/usecases/final-application/actions";

interface Props {
  caseId:        string;
  caseStatus:    string;
  surveys:       Survey[];
  reviewItems:   FinalReviewItem[];
  linkages:      FinalSpecialistLinkage[];
  readiness:     FinalReadinessResult;
  finalPackages: ApplicationPackage[];
  canEdit:       boolean;
  canStatusChange: boolean;
  specialists:   SpecialistUserOption[];
}

// ============================================================
// メインコンポーネント
// ============================================================

export function CompletionTabClient({
  caseId,
  caseStatus,
  surveys,
  reviewItems,
  linkages,
  readiness,
  finalPackages,
  canEdit,
  canStatusChange,
  specialists,
}: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function notify(msg: string, isError = false) {
    if (isError) { setErrorMsg(msg); setSuccessMsg(null); }
    else          { setSuccessMsg(msg); setErrorMsg(null); }
    setTimeout(() => { setErrorMsg(null); setSuccessMsg(null); }, 4000);
  }

  return (
    <div className="space-y-6">
      {/* フィードバック */}
      {errorMsg   && <Banner type="error"   message={errorMsg} />}
      {successMsg && <Banner type="success" message={successMsg} />}

      {/* 完了条件サマリー */}
      <ReadinessCard readiness={readiness} />

      {/* アンケート回収 */}
      <SurveySection
        caseId={caseId}
        surveys={surveys}
        canEdit={canEdit}
        onNotify={notify}
      />

      {/* 終了申請準備チェックリスト */}
      <ReviewChecklistSection
        caseId={caseId}
        items={reviewItems}
        canEdit={canEdit}
        onNotify={notify}
      />

      {/* 最終申請パッケージ */}
      <FinalPackagesSection packages={finalPackages} />

      {/* 最終社労士連携 */}
      <SpecialistLinkageSection
        caseId={caseId}
        linkages={linkages}
        packages={finalPackages}
        readiness={readiness}
        canEdit={canEdit}
        specialists={specialists}
        onNotify={notify}
      />

      {/* 完了遷移 */}
      {canStatusChange && (
        <CompletionSection
          caseId={caseId}
          caseStatus={caseStatus}
          readiness={readiness}
          linkages={linkages}
          onNotify={notify}
        />
      )}
    </div>
  );
}

// ============================================================
// 完了条件サマリー
// ============================================================

function ReadinessCard({ readiness }: { readiness: FinalReadinessResult }) {
  const items = [
    {
      label:   `アンケート回収 (${readiness.surveyRespondedCount}/${readiness.surveyTotalCount})`,
      ok:      readiness.surveyAllResponded,
    },
    {
      label:   `確認チェックリスト (${readiness.reviewItemsChecked}/${readiness.reviewItemsTotal})`,
      ok:      readiness.allItemsChecked,
    },
    {
      label:   "証憑回収",
      ok:      !readiness.hasEvidenceUncollected,
    },
  ];

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
      <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">完了条件</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className={[
                "w-4 h-4 flex items-center justify-center rounded-sm text-xs font-bold",
                item.ok
                  ? "bg-[#16A34A] text-white"
                  : "bg-[#DC2626] text-white",
              ].join(" ")}
              aria-label={item.ok ? "完了" : "未完了"}
            >
              {item.ok ? "✓" : "✗"}
            </span>
            <span className={item.ok ? "text-[var(--color-text-sub)]" : "text-[var(--color-text)]"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      {readiness.ready ? (
        <p className="mt-3 text-sm font-medium text-[#16A34A]">
          すべての条件を満たしています。完了処理が可能です。
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          未対応の項目があります。
        </p>
      )}
    </section>
  );
}

// ============================================================
// アンケートセクション
// ============================================================

function SurveySection({
  caseId,
  surveys,
  canEdit,
  onNotify,
}: {
  caseId:   string;
  surveys:  Survey[];
  canEdit:  boolean;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleStatusChange(surveyId: string, status: SurveyStatus) {
    startTransition(async () => {
      const res = await updateSurveyStatusAction({ caseId, surveyId, status });
      if (res.error) onNotify(res.error, true);
      else           onNotify("アンケートステータスを更新しました");
    });
  }

  function handleDelete(surveyId: string) {
    if (!confirm("このアンケート記録を削除しますか？")) return;
    startTransition(async () => {
      const res = await deleteSurveyAction({ caseId, surveyId });
      if (res.error) onNotify(res.error, true);
      else           onNotify("削除しました");
    });
  }

  const statusOptions: SurveyStatus[] = ["not_sent", "sent", "responded", "skipped"];

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          アンケート回収
          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
            {surveys.filter((s) => s.status === "responded" || s.status === "skipped").length}/{surveys.length} 件
          </span>
        </h2>
      </div>

      {surveys.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          アンケート記録がありません。
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {surveys.map((s) => (
            <li key={s.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {s.participantName ?? "（受講者未指定）"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {SURVEY_TYPE_LABELS[s.surveyType]}
                  {s.sentTo && ` / 送付先: ${s.sentTo}`}
                  {s.sentAt && ` / 送付: ${formatDate(s.sentAt)}`}
                  {s.respondedAt && ` / 回収: ${formatDate(s.respondedAt)}`}
                </p>
              </div>
              {canEdit ? (
                <select
                  className="text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-1 bg-white text-[var(--color-text)]"
                  value={s.status}
                  disabled={pending}
                  onChange={(e) => handleStatusChange(s.id, e.target.value as SurveyStatus)}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>{SURVEY_STATUS_LABELS[opt]}</option>
                  ))}
                </select>
              ) : (
                <StatusChip status={s.status} label={SURVEY_STATUS_LABELS[s.status]} />
              )}
              {canEdit && (
                <button
                  type="button"
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] underline"
                  onClick={() => handleDelete(s.id)}
                  disabled={pending}
                >
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// チェックリストセクション
// ============================================================

function ReviewChecklistSection({
  caseId,
  items,
  canEdit,
  onNotify,
}: {
  caseId:   string;
  items:    FinalReviewItem[];
  canEdit:  boolean;
  onNotify: (msg: string, isError?: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle(itemId: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleFinalReviewItemAction({
        caseId,
        itemId,
        isChecked: !current,
      });
      if (res.error) onNotify(res.error, true);
    });
  }

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          終了申請準備チェックリスト
          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
            {items.filter((i) => i.isChecked).length}/{items.length} 件確認済み
          </span>
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          チェック項目がありません。
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3 flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-[var(--color-accent)] flex-shrink-0"
                checked={item.isChecked}
                disabled={!canEdit || pending}
                onChange={() => handleToggle(item.id, item.isChecked)}
                aria-label={item.label}
              />
              <div className="flex-1 min-w-0">
                <p className={[
                  "text-sm",
                  item.isChecked
                    ? "line-through text-[var(--color-text-muted)]"
                    : "text-[var(--color-text)] font-medium",
                ].join(" ")}>
                  {item.label}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {FINAL_REVIEW_ITEM_TYPE_LABELS[item.itemType]}
                  {item.checkedByName && ` / 確認: ${item.checkedByName}`}
                  {item.checkedAt && ` (${formatDate(item.checkedAt)})`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// 最終申請パッケージ
// ============================================================

function FinalPackagesSection({ packages }: { packages: ApplicationPackage[] }) {
  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text)]">最終申請パッケージ</h2>
      </div>

      {packages.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          パッケージがまだ作成されていません。
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {packages.map((pkg) => (
            <li key={pkg.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  最終申請パッケージ
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  作成: {formatDate(pkg.generatedAt)}
                  {pkg.generatedByName && ` / ${pkg.generatedByName}`}
                  {pkg.sharedAt && ` / 共有済み: ${formatDate(pkg.sharedAt)}`}
                </p>
              </div>
              <StatusChip
                status={pkg.packageStatus}
                label={pkg.packageStatus === "shared" ? "共有済み" : pkg.packageStatus === "archived" ? "アーカイブ" : "ドラフト"}
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                {pkg.items.length} ファイル
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================
// 最終社労士連携
// ============================================================

function SpecialistLinkageSection({
  caseId,
  linkages,
  packages,
  readiness,
  canEdit,
  specialists,
  onNotify,
}: {
  caseId:    string;
  linkages:  FinalSpecialistLinkage[];
  packages:  ApplicationPackage[];
  readiness: FinalReadinessResult;
  canEdit:   boolean;
  specialists: SpecialistUserOption[];
  onNotify:  (msg: string, isError?: boolean) => void;
}) {
  const [linkedTo, setLinkedTo] = useState("");
  const [note, setNote]         = useState("");
  const [packageId, setPackageId] = useState("");
  const [specialistUserId, setSpecialistUserId] = useState("");
  const [pending, startTransition] = useTransition();

  const selectedSpecialist =
    specialists.find((specialist) => specialist.id === specialistUserId) ?? null;
  const computedLinkedTo =
    linkedTo.trim() ||
    (selectedSpecialist
      ? `${selectedSpecialist.displayName}${selectedSpecialist.email ? ` / ${selectedSpecialist.email}` : ""}`
      : "");

  function handleRecord() {
    if (!readiness.ready) {
      onNotify("完了条件を満たしていません。チェックリストを確認してください。", true);
      return;
    }
    startTransition(async () => {
      const res = await recordFinalSpecialistLinkageAction({
        caseId,
        packageId: packageId || undefined,
        linkedTo:  computedLinkedTo || undefined,
        note:      note || undefined,
        specialistUserId: specialistUserId || undefined,
      });
      if (res.error) onNotify(res.error, true);
      else {
        onNotify("最終社労士連携を記録しました（ステータス: 最終申請連携済み）");
        setLinkedTo(""); setNote(""); setPackageId(""); setSpecialistUserId("");
      }
    });
  }

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text)]">最終社労士連携</h2>
      </div>

      {/* 連携履歴 */}
      {linkages.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] border-b border-[var(--color-border)]">
          {linkages.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <p className="text-sm text-[var(--color-text)]">
                {l.linkedTo ?? "（連携先未記載）"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {formatDate(l.linkedAt)}
                {l.createdByName && ` / ${l.createdByName}`}
                {l.note && ` / ${l.note}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium text-[var(--color-text)]">連携を記録する</p>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
              社労士アカウント
            </label>
            <select
              className="w-full text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 bg-white text-[var(--color-text)]"
              value={specialistUserId}
              onChange={(e) => setSpecialistUserId(e.target.value)}
              disabled={pending}
            >
              <option value="">（未選択 / 履歴のみ記録）</option>
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.displayName}
                  {specialist.email ? ` / ${specialist.email}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              ここで選択すると、対象社労士の専用画面にも案件が表示されます。
            </p>
          </div>

          {packages.length > 0 && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                パッケージ
              </label>
              <select
                className="w-full text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 bg-white text-[var(--color-text)]"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                disabled={pending}
              >
                <option value="">（選択しない）</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    最終申請パッケージ — {formatDate(p.generatedAt)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
              連携先（社労士名・メール等）
            </label>
            <input
              type="text"
              className="w-full text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--color-text)]"
              placeholder="例: 山田社労士事務所 / yamada@sr.example.com"
              value={linkedTo}
              onChange={(e) => setLinkedTo(e.target.value)}
              disabled={pending}
            />
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">メモ</label>
            <input
              type="text"
              className="w-full text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--color-text)]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
            />
          </div>

          <button
            type="button"
            className={[
              "px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] text-white",
              readiness.ready
                ? "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
                : "bg-[var(--color-border-strong)] cursor-not-allowed",
            ].join(" ")}
            onClick={handleRecord}
            disabled={pending || !readiness.ready}
          >
            {pending ? "処理中..." : "最終連携を記録する"}
          </button>

          {!readiness.ready && (
            <p className="text-xs text-[var(--color-text-muted)]">
              完了条件を満たすまで連携は記録できません。
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================
// 完了遷移パネル
// ============================================================

function CompletionSection({
  caseId,
  caseStatus,
  readiness,
  linkages,
  onNotify,
}: {
  caseId:    string;
  caseStatus: string;
  readiness: FinalReadinessResult;
  linkages:  FinalSpecialistLinkage[];
  onNotify:  (msg: string, isError?: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  const alreadyCompleted  = caseStatus === "completed";
  const hasLinkage        = linkages.length > 0;
  const canComplete       = readiness.ready && hasLinkage && !alreadyCompleted;

  function handleComplete() {
    if (!confirm("案件を「完了」に変更します。この操作は元に戻せません。よろしいですか？")) return;
    startTransition(async () => {
      const res = await completeCaseAction(caseId);
      if (res.error) onNotify(res.error, true);
      else           onNotify("案件を完了しました");
    });
  }

  if (alreadyCompleted) {
    return (
      <section className="border border-[#16A34A] rounded-[var(--radius-md)] p-4 bg-[rgba(22,163,74,0.05)]">
        <p className="text-sm font-semibold text-[#16A34A]">この案件は完了しています。</p>
      </section>
    );
  }

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
      <h2 className="text-base font-semibold text-[var(--color-text)]">案件完了処理</h2>

      <div className="text-sm text-[var(--color-text-sub)] space-y-1">
        <p>以下をすべて満たした場合に「完了」へ遷移できます:</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs text-[var(--color-text-muted)]">
          <li className={readiness.ready ? "text-[#16A34A]" : ""}>
            完了条件クリア {readiness.ready ? "✓" : "✗"}
          </li>
          <li className={hasLinkage ? "text-[#16A34A]" : ""}>
            最終社労士連携記録あり {hasLinkage ? "✓" : "✗"}
          </li>
        </ul>
      </div>

      <button
        type="button"
        className={[
          "px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] text-white",
          canComplete
            ? "bg-[#16A34A] hover:bg-[#15803d]"
            : "bg-[var(--color-border-strong)] cursor-not-allowed",
        ].join(" ")}
        onClick={handleComplete}
        disabled={!canComplete || pending}
      >
        {pending ? "処理中..." : "案件を完了にする"}
      </button>
    </section>
  );
}

// ============================================================
// 共通UI
// ============================================================

function StatusChip({ status, label }: { status: string; label: string }) {
  const color =
    status === "responded" || status === "shared"  ? "bg-[rgba(22,163,74,0.1)] text-[#16A34A] border-[#16A34A]" :
    status === "sent"                              ? "bg-[rgba(26,86,219,0.08)] text-[var(--color-accent)] border-[var(--color-accent)]" :
    status === "skipped" || status === "archived"  ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)]" :
    "bg-[rgba(202,138,4,0.08)] text-[#CA8A04] border-[#CA8A04]";

  return (
    <span className={["text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)] border font-medium", color].join(" ")}>
      {label}
    </span>
  );
}

function Banner({ type, message }: { type: "error" | "success"; message: string }) {
  return (
    <div className={[
      "px-4 py-2 rounded-[var(--radius-sm)] text-sm",
      type === "error"
        ? "bg-[rgba(220,38,38,0.08)] text-[#DC2626] border border-[#DC2626]"
        : "bg-[rgba(22,163,74,0.08)] text-[#16A34A] border border-[#16A34A]",
    ].join(" ")}>
      {message}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch {
    return iso;
  }
}
