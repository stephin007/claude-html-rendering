import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPrototype,
  useGetComments,
  useCreateComment,
  useToggleCommentResolved,
  useDeleteComment,
  useUpdateComment,
  getGetPrototypeQueryKey,
  getGetCommentsQueryKey,
} from "@workspace/api-client-react";
import { useTitle } from "@/hooks/useTitle";

export default function View() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [commentMode, setCommentMode] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [hoveredBubbleId, setHoveredBubbleId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"design" | "comments">("design");

  // New comment popup state
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Ref map for sidebar comment cards (for scroll-into-view on bubble hover/click)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setCardRef = useCallback(
    (commentId: string) => (node: HTMLDivElement | null) => {
      if (node) {
        cardRefs.current.set(commentId, node);
      } else {
        cardRefs.current.delete(commentId);
      }
    },
    []
  );

  const { data: prototype } = useGetPrototype(id, {
    query: { enabled: !!id, queryKey: getGetPrototypeQueryKey(id) },
  });

  useTitle(prototype ? `${prototype.projectName} / ${prototype.fileName}` : null);

  const { data: comments = [] } = useGetComments(id, {
    query: {
      enabled: !!id,
      refetchInterval: 3000,
      queryKey: getGetCommentsQueryKey(id),
    },
  });

  const createComment = useCreateComment();
  const toggleResolved = useToggleCommentResolved();
  const deleteComment = useDeleteComment();
  const updateComment = useUpdateComment();

  useEffect(() => {
    if (popup && inputRef.current) {
      inputRef.current.focus();
    }
  }, [popup]);

  useEffect(() => {
    if (editingCommentId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingCommentId]);

  // Scroll hovered bubble's sidebar card into view
  useEffect(() => {
    if (!hoveredBubbleId) return;
    const node = cardRefs.current.get(hoveredBubbleId);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [hoveredBubbleId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("textarea, input")) return;
      if (e.key === "c" || e.key === "C") {
        setCommentMode((prev) => !prev);
        setPopup(null);
      } else if (e.key === "Escape") {
        if (popup !== null) {
          setPopup(null);
        } else if (commentMode) {
          setCommentMode(false);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [popup, commentMode]);

  const blobUrl = useMemo(() => {
    if (!prototype?.htmlContent) return "";
    const blob = new Blob([prototype.htmlContent], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [prototype?.htmlContent]);

  if (!prototype) return <div className="p-8 font-mono">LOADING...</div>;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!commentMode) return;
    if ((e.target as HTMLElement).closest(".comment-bubble")) return;
    if ((e.target as HTMLElement).closest(".comment-popup")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    setPopup({ x: percentX, y: percentY });
    setNewCommentText("");
  };

  const handleSaveComment = () => {
    if (!popup || !newCommentText.trim()) return;
    createComment.mutate(
      { id, data: { x: popup.x, y: popup.y, text: newCommentText.trim() } },
      {
        onSuccess: () => {
          setPopup(null);
          setNewCommentText("");
          queryClient.invalidateQueries({ queryKey: getGetCommentsQueryKey(id) });
        },
      }
    );
  };

  const handleToggleResolve = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleResolved.mutate(
      { id: commentId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCommentsQueryKey(id) }) }
    );
  };

  const handleDeleteComment = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteComment.mutate(
      { id: commentId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCommentsQueryKey(id) }) }
    );
  };

  const startEdit = (commentId: string, currentText: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    setEditingCommentId(commentId);
    setEditText(currentText);
  };

  const saveEdit = (commentId: string) => {
    if (!editText.trim()) return;
    updateComment.mutate(
      { id: commentId, data: { text: editText.trim() } },
      {
        onSuccess: () => {
          setEditingCommentId(null);
          setEditText("");
          queryClient.invalidateQueries({ queryKey: getGetCommentsQueryKey(id) });
        },
      }
    );
  };

  const handleSaveEdit = (commentId: string, e: React.SyntheticEvent) => {
    e.stopPropagation();
    saveEdit(commentId);
  };

  const handleCancelEdit = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setEditingCommentId(null);
    setEditText("");
  };

  const copyForClaude = () => {
    const text = `Feedback on ${prototype.projectName} — ${prototype.fileName} — ${comments.length} comments:\n\n${comments
      .map((c, i) => `#${i + 1} — ${c.text}`)
      .join("\n")}`;
    navigator.clipboard.writeText(text);
  };

  // ── Comment card (shared between sidebar and mobile comments tab) ─────────────
  const CommentCard = ({ comment, idx }: { comment: (typeof comments)[number]; idx: number }) => {
    const isHovered = hoveredBubbleId === comment.id;
    const isActive = activeCommentId === comment.id;
    return (
      <div
        ref={setCardRef(comment.id)}
        className={`p-3 border-l-2 cursor-pointer border border-border relative group transition-colors ${
          comment.resolved ? "opacity-60 border-l-[#444444] bg-card" : "border-l-accent bg-card"
        } ${isActive ? "ring-1 ring-border" : ""} ${isHovered ? "bg-accent/10 border-accent" : ""}`}
        onClick={() => setActiveCommentId(comment.id)}
        data-testid={`card-${comment.id}`}
      >
        {editingCommentId === comment.id ? (
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-5 h-5 shrink-0 flex items-center justify-center text-xs ${
                  comment.resolved ? "bg-[#444444] text-gray-300" : "bg-accent text-background"
                }`}
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 25% 100%, 0 75%)" }}
              >
                {idx + 1}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Editing</span>
            </div>
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-background border border-border text-foreground p-2 min-h-[64px] resize-none outline-none focus:border-accent text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit(comment.id);
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setEditingCommentId(null);
                  setEditText("");
                }
              }}
              data-testid={`input-edit-comment-${comment.id}`}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-2 py-1 text-xs border border-border text-muted-foreground hover:border-accent interactive-element"
                data-testid={`btn-cancel-edit-${comment.id}`}
              >
                CANCEL
              </button>
              <button
                onClick={(e) => handleSaveEdit(comment.id, e)}
                className="px-2 py-1 text-xs border border-accent bg-accent text-background hover:opacity-90 interactive-element"
                data-testid={`btn-save-edit-${comment.id}`}
              >
                SAVE
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 mb-2 pr-14">
              <span
                className={`w-5 h-5 shrink-0 flex items-center justify-center text-xs ${
                  comment.resolved ? "bg-[#444444] text-gray-300" : "bg-accent text-background"
                }`}
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 25% 100%, 0 75%)" }}
              >
                {idx + 1}
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                  {comment.authorEmail ?? "anonymous"}
                </span>
                <p
                  className={`text-sm ${
                    comment.resolved ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                  onDoubleClick={(e) => startEdit(comment.id, comment.text, e)}
                  title="Double-click to edit"
                >
                  {comment.text}
                </p>
              </div>
            </div>

            {/* Action buttons — always visible on touch, hover-only on desktop */}
            <div className="absolute top-2 right-2 flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => startEdit(comment.id, comment.text, e)}
                className="text-muted-foreground hover:text-accent interactive-element text-xs p-1"
                title="Edit comment"
                data-testid={`btn-edit-comment-${comment.id}`}
              >
                ✎
              </button>
              <button
                onClick={(e) => handleDeleteComment(comment.id, e)}
                className="text-muted-foreground hover:text-red-500 interactive-element text-xs p-1"
                title="Delete comment"
                data-testid={`btn-delete-comment-${comment.id}`}
              >
                ✕
              </button>
            </div>

            <div className="flex justify-end mt-3">
              <button
                onClick={(e) => handleToggleResolve(comment.id, e)}
                className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-2 py-1 interactive-element hover:border-accent hover:text-accent"
                data-testid={`btn-resolve-${comment.id}`}
              >
                {comment.resolved ? "REOPEN" : "RESOLVE"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Comment new-popup (shared between overlay and mobile bottom-sheet) ────────
  const NewCommentPopup = ({ fixed }: { fixed?: boolean }) => (
    <div
      className={`comment-popup z-50 border border-border p-3 shadow-2xl flex flex-col gap-3 ${
        fixed
          ? "fixed inset-x-4 bottom-24 md:hidden"
          : "absolute min-w-[240px]"
      }`}
      style={
        fixed
          ? { backgroundColor: "#0a0a0a" }
          : {
              left: `${Math.min(Math.max(popup!.x, 5), 75)}%`,
              top: `${Math.min(Math.max(popup!.y, 5), 85)}%`,
              backgroundColor: "#0a0a0a",
            }
      }
      onClick={(e) => e.stopPropagation()}
      data-testid="popup-new-comment"
    >
      <textarea
        ref={inputRef}
        value={newCommentText}
        onChange={(e) => setNewCommentText(e.target.value)}
        className="w-full bg-background border border-border text-foreground p-2 min-h-[80px] resize-none outline-none focus:border-accent text-sm"
        placeholder="Leave a comment..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSaveComment();
          }
        }}
        data-testid="input-comment"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setPopup(null)}
          className="px-3 py-1 text-sm border border-border text-muted-foreground hover:border-accent hover:text-foreground interactive-element"
          data-testid="btn-cancel-comment"
        >
          CANCEL
        </button>
        <button
          onClick={handleSaveComment}
          className="px-3 py-1 text-sm border border-accent bg-accent text-background hover:opacity-90 interactive-element"
          data-testid="btn-save-comment"
        >
          SAVE
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col font-mono bg-background text-foreground overflow-hidden">
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 border-b border-border shrink-0 gap-2">
        <Link
          href={prototype.projectId ? `/project/${prototype.projectId}` : "/"}
          className="text-base md:text-lg lowercase interactive-element p-1 px-2 border border-transparent -ml-1 shrink-0"
          data-testid="link-home"
        >
          framelink
        </Link>

        {/* Breadcrumb — hidden on small screens */}
        <div className="hidden md:flex text-muted-foreground uppercase tracking-widest text-sm items-center gap-2 overflow-hidden">
          <Link
            href={prototype.projectId ? `/project/${prototype.projectId}` : "/"}
            className="text-foreground font-bold hover:text-accent interactive-element transition-colors truncate"
            data-testid="link-project-name"
          >
            {prototype.projectName}
          </Link>
          <span className="shrink-0">/</span>
          <span className="truncate">{prototype.fileName}</span>
        </div>

        {/* Comment mode toggle */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <button
            onClick={() => {
              setCommentMode(!commentMode);
              setPopup(null);
            }}
            className={`px-3 md:px-5 py-1.5 md:py-2 border-2 uppercase tracking-wider interactive-element text-xs md:text-sm font-bold transition-colors ${
              commentMode
                ? "bg-accent text-background border-accent"
                : "border-accent text-accent hover:bg-accent hover:text-background"
            }`}
            data-testid="btn-toggle-comment"
          >
            {commentMode ? "// COMMENTING" : "+ ADD COMMENT"}
          </button>
          {!commentMode && (
            <span className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest">
              tap to pin feedback &nbsp;[C]
            </span>
          )}
        </div>
      </header>

      {/* ── Mobile tab bar ─────────────────────────────────────────────────── */}
      <div className="flex md:hidden border-b border-border shrink-0">
        <button
          onClick={() => setMobileTab("design")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border-b-2 transition-colors ${
            mobileTab === "design"
              ? "border-accent text-accent"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Design
        </button>
        <button
          onClick={() => setMobileTab("comments")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border-b-2 transition-colors ${
            mobileTab === "comments"
              ? "border-accent text-accent"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Comments {comments.length > 0 && `(${comments.length})`}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Design / Prototype pane ─────────────────────────────────────── */}
        <main
          className={`bg-white ${
            mobileTab === "design" ? "flex-1" : "hidden"
          } md:flex md:flex-1 overflow-auto md:overflow-hidden`}
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {/* Inner container: 1024 px wide on mobile so the prototype renders
              at desktop scale and the user can scroll/pinch-zoom around it.
              On desktop (md:) it reverts to full flex layout. */}
          <div className="relative h-full min-w-[1024px] md:min-w-0 md:flex-1">
          <iframe
            src={blobUrl}
            className="w-full h-full border-none"
            title="Prototype View"
            sandbox="allow-scripts allow-same-origin"
          />

          {/* Comment overlay */}
          <div
            className={`absolute inset-0 z-10 ${commentMode ? "cursor-crosshair" : ""}`}
            style={{ pointerEvents: commentMode ? "auto" : "none" }}
            onClick={handleOverlayClick}
            data-testid="overlay"
          >
            {comments.map((comment, idx) => (
              <div
                key={comment.id}
                className="comment-bubble absolute"
                style={{
                  left: `${comment.x}%`,
                  top: `${comment.y}%`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "auto",
                  zIndex: activeCommentId === comment.id ? 50 : 20,
                }}
                onMouseEnter={() => setHoveredBubbleId(comment.id)}
                onMouseLeave={() => setHoveredBubbleId(null)}
              >
                <div
                  className={`w-7 h-7 md:w-6 md:h-6 flex items-center justify-center cursor-pointer transition-transform
                    ${comment.resolved ? "bg-[#444444] text-gray-300" : "bg-accent text-background"}
                    ${activeCommentId === comment.id || hoveredBubbleId === comment.id ? "scale-125" : ""}
                  `}
                  style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 25% 100%, 0 75%)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveCommentId(comment.id);
                    const node = cardRefs.current.get(comment.id);
                    if (node) {
                      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                  }}
                  data-testid={`bubble-${comment.id}`}
                >
                  <span className="text-xs font-bold">{idx + 1}</span>
                </div>

                {/* Hover tooltip — desktop only */}
                {hoveredBubbleId === comment.id && (
                  <div
                    className="hidden md:block absolute left-7 top-0 z-50 bg-background border border-border px-2 py-1 text-xs text-foreground whitespace-pre-wrap max-w-[220px] shadow-lg pointer-events-none"
                    style={{ minWidth: "120px" }}
                  >
                    {comment.text}
                  </div>
                )}
              </div>
            ))}

            {/* New comment popup — desktop: anchored near click; mobile: fixed bottom */}
            {popup && (
              <>
                {/* Desktop popup — hidden on mobile */}
                <div
                  className="comment-popup hidden md:flex absolute z-50 border border-border p-3 shadow-2xl flex-col gap-3 min-w-[240px]"
                  style={{
                    left: `${Math.min(Math.max(popup.x, 5), 70)}%`,
                    top: `${Math.min(Math.max(popup.y, 5), 80)}%`,
                    backgroundColor: "#0a0a0a",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  data-testid="popup-new-comment"
                >
                  <textarea
                    ref={inputRef}
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="w-full bg-background border border-border text-foreground p-2 min-h-[80px] resize-none outline-none focus:border-accent text-sm"
                    placeholder="Leave a comment..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveComment();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setPopup(null)}
                      className="px-3 py-1 text-sm border border-border text-muted-foreground hover:border-accent hover:text-foreground interactive-element"
                      data-testid="btn-cancel-comment"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleSaveComment}
                      className="px-3 py-1 text-sm border border-accent bg-accent text-background hover:opacity-90 interactive-element"
                      data-testid="btn-save-comment"
                    >
                      SAVE
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          </div>{/* end inner scroll container */}
        </main>

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <aside className="hidden md:flex w-[320px] shrink-0 border-l border-border bg-background flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="tracking-widest uppercase text-sm font-bold">COMMENTS</h2>
            <span className="text-muted-foreground text-sm">{comments.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.map((comment, idx) => (
              <CommentCard key={comment.id} comment={comment} idx={idx} />
            ))}
            {comments.length === 0 && <EmptyState />}
          </div>

          <div className="p-4 border-t border-border shrink-0">
            <button
              onClick={copyForClaude}
              className="w-full py-3 border border-border text-sm uppercase tracking-wider interactive-element hover:border-accent hover:text-accent transition-colors bg-background"
              data-testid="btn-copy-claude"
            >
              → COPY ALL FOR CLAUDE
            </button>
          </div>
        </aside>

        {/* ── Mobile comments panel ───────────────────────────────────────── */}
        <div
          className={`flex-1 flex-col bg-background overflow-hidden ${
            mobileTab === "comments" ? "flex" : "hidden"
          } md:hidden`}
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {comments.map((comment, idx) => (
              <CommentCard key={comment.id} comment={comment} idx={idx} />
            ))}
            {comments.length === 0 && <EmptyState />}
          </div>
          <div className="p-3 border-t border-border shrink-0">
            <button
              onClick={copyForClaude}
              className="w-full py-3 border border-border text-sm uppercase tracking-wider interactive-element hover:border-accent hover:text-accent transition-colors bg-background"
              data-testid="btn-copy-claude-mobile"
            >
              → COPY ALL FOR CLAUDE
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile new-comment bottom sheet ─────────────────────────────────── */}
      {popup && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setPopup(null)}>
          <div
            className="comment-popup w-full border-t border-border p-4 flex flex-col gap-3"
            style={{ backgroundColor: "#0a0a0a" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                New comment
              </span>
              <button
                onClick={() => setPopup(null)}
                className="text-muted-foreground text-lg leading-none interactive-element"
              >
                ✕
              </button>
            </div>
            <textarea
              ref={inputRef}
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              className="w-full bg-background border border-border text-foreground p-2 min-h-[90px] resize-none outline-none focus:border-accent text-sm"
              placeholder="Leave a comment..."
              data-testid="input-comment"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPopup(null)}
                className="flex-1 py-2 text-sm border border-border text-muted-foreground interactive-element"
                data-testid="btn-cancel-comment"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveComment}
                className="flex-1 py-2 text-sm border border-accent bg-accent text-background interactive-element"
                data-testid="btn-save-comment"
              >
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-muted-foreground text-sm uppercase tracking-widest">No comments yet</p>
      <p className="text-muted-foreground text-xs leading-relaxed max-w-[200px]">
        Click <span className="text-accent font-bold">+ ADD COMMENT</span> in the toolbar, then
        tap anywhere on the design to pin feedback
      </p>
    </div>
  );
}
