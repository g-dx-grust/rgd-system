"use client";

import { useState, useRef, useEffect } from "react";
import type { SpecialistCommentRow } from "@/server/repositories/specialist";

interface Props {
  caseId: string;
  initialComments: SpecialistCommentRow[];
  apiBase: string;
  /** 社労士側から表示する場合 true、内部スタッフ側は false */
  currentUserIsSpecialist: boolean;
}

export function CommentsClient({
  initialComments,
  apiBase,
  currentUserIsSpecialist,
}: Props) {
  const [comments, setComments] = useState<SpecialistCommentRow[]>(initialComments);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<SpecialistCommentRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body:      body.trim(),
          parent_id: replyTo?.id ?? null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "送信に失敗しました");
        return;
      }

      // 最新コメントを再取得
      const listRes = await fetch(apiBase);
      if (listRes.ok) {
        const j = await listRes.json();
        setComments(j.comments ?? []);
      }

      setBody("");
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  }

  // ルートコメントと返信を分けてレンダリング
  const roots  = comments.filter((c) => !c.parentId);
  const byParent = comments.reduce<Record<string, SpecialistCommentRow[]>>((acc, c) => {
    if (c.parentId) {
      acc[c.parentId] = [...(acc[c.parentId] ?? []), c];
    }
    return acc;
  }, {});

  function bubbleClass(isFromSpecialist: boolean) {
    return isFromSpecialist === currentUserIsSpecialist
      ? "ml-auto bg-[var(--color-accent-tint)] border-[var(--color-accent)]"
      : "mr-auto bg-white border-[var(--color-border)]";
  }

  function labelText(c: SpecialistCommentRow) {
    const name = c.authorName ?? "—";
    return c.isFromSpecialist ? `社労士 · ${name}` : `訓練会社 · ${name}`;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* スレッド */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-4 min-h-[200px] max-h-[500px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-8">
            まだコメントはありません
          </p>
        ) : (
          roots.map((root) => (
            <div key={root.id} className="space-y-2">
              {/* ルートコメント */}
              <CommentBubble
                comment={root}
                bubbleClass={bubbleClass(root.isFromSpecialist)}
                label={labelText(root)}
                onReply={() => setReplyTo(root)}
                showReply
              />
              {/* 返信 */}
              {(byParent[root.id] ?? []).map((reply) => (
                <div key={reply.id} className="pl-6">
                  <CommentBubble
                    comment={reply}
                    bubbleClass={bubbleClass(reply.isFromSpecialist)}
                    label={labelText(reply)}
                    onReply={() => setReplyTo(reply)}
                    showReply={false}
                  />
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 返信先インジケーター */}
      {replyTo && (
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-sub)]">
          <span className="text-[var(--color-text-muted)]">返信先:</span>
          <span className="flex-1 truncate">{replyTo.body}</span>
          <button
            onClick={() => setReplyTo(null)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#DC2626]">
          {error}
        </p>
      )}

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            currentUserIsSpecialist
              ? "訓練会社へのメッセージを入力…"
              : "社労士へのメッセージを入力…"
          }
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] resize-y"
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="flex-shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
        >
          {submitting ? "送信中…" : "送信"}
        </button>
      </form>
    </div>
  );
}

function CommentBubble({
  comment,
  bubbleClass,
  label,
  onReply,
  showReply,
}: {
  comment: SpecialistCommentRow;
  bubbleClass: string;
  label: string;
  onReply: () => void;
  showReply: boolean;
}) {
  return (
    <div className={["max-w-[80%] rounded-[var(--radius-md)] border px-3 py-2 space-y-1", bubbleClass].join(" ")}>
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{comment.body}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          {new Date(comment.createdAt).toLocaleString("ja-JP", {
            month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
            timeZone: "Asia/Tokyo",
          })}
        </p>
        {showReply && (
          <button
            onClick={onReply}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            返信
          </button>
        )}
      </div>
    </div>
  );
}
