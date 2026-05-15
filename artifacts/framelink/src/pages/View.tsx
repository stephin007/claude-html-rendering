import React, { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPrototype,
  useGetComments,
  useCreateComment,
  useResolveComment,
  getGetPrototypeQueryKey,
  getGetCommentsQueryKey,
} from "@workspace/api-client-react";

export default function View() {
  const { id } = useParams<{ id: string }>();
  
  const [commentMode, setCommentMode] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  
  // New comment popup state
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: prototype } = useGetPrototype(id, {
    query: { enabled: !!id, queryKey: getGetPrototypeQueryKey(id) },
  });

  const { data: comments = [] } = useGetComments(id, {
    query: {
      enabled: !!id,
      refetchInterval: 3000,
      queryKey: getGetCommentsQueryKey(id),
    },
  });

  const createComment = useCreateComment();
  const resolveComment = useResolveComment();

  useEffect(() => {
    if (popup && inputRef.current) {
      inputRef.current.focus();
    }
  }, [popup]);

  if (!prototype) return <div className="p-8 font-mono">LOADING...</div>;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!commentMode) return;
    
    // Don't trigger if clicking on an existing bubble
    if ((e.target as HTMLElement).closest('.comment-bubble')) return;
    if ((e.target as HTMLElement).closest('.comment-popup')) return;

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
      {
        id,
        data: {
          x: popup.x,
          y: popup.y,
          text: newCommentText.trim(),
        },
      },
      {
        onSuccess: () => {
          setPopup(null);
          setNewCommentText("");
        },
      }
    );
  };

  const copyForClaude = () => {
    const text = `Feedback on ${prototype.fileName} — ${comments.length} comments:\n${comments
      .map((c, i) => `#${i + 1} — ${c.text}`)
      .join("\n")}`;
    navigator.clipboard.writeText(text);
  };

  const blob = new Blob([prototype.htmlContent], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  return (
    <div className="h-screen w-full flex flex-col font-mono bg-background text-foreground overflow-hidden">
      {/* Topbar */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
        <Link href="/" className="text-lg lowercase interactive-element p-1 px-2 border border-transparent -ml-2" data-testid="link-home">
          framelink
        </Link>
        <div className="text-muted-foreground">{prototype.fileName}</div>
        <button
          onClick={() => {
            setCommentMode(!commentMode);
            setPopup(null);
          }}
          className={`px-4 py-2 border uppercase tracking-wider interactive-element ${
            commentMode 
              ? "bg-accent text-background border-accent" 
              : "border-border text-foreground hover:border-accent"
          }`}
          data-testid="btn-toggle-comment"
        >
          {commentMode ? "// COMMENTING" : "// BROWSE"}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 relative bg-white">
          <iframe
            src={blobUrl}
            className="w-full h-full border-none"
            title="Prototype View"
            sandbox="allow-scripts allow-same-origin"
          />
          
          <div
            className="absolute inset-0 z-10"
            style={{ pointerEvents: commentMode ? "auto" : "none" }}
            onClick={handleOverlayClick}
            data-testid="overlay"
          >
            {comments.map((comment, idx) => (
              <div
                key={comment.id}
                className={`comment-bubble absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer
                  ${comment.resolved ? "bg-[#444444] text-gray-300" : "bg-accent text-background"}
                  ${activeCommentId === comment.id ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""}
                `}
                style={{
                  left: `${comment.x}%`,
                  top: `${comment.y}%`,
                  clipPath: "polygon(0 0, 100% 0, 100% 100%, 25% 100%, 0 75%)",
                  pointerEvents: "auto",
                  zIndex: activeCommentId === comment.id ? 50 : 20,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCommentId(comment.id);
                }}
                data-testid={`bubble-${comment.id}`}
              >
                <span className="text-xs font-bold">{idx + 1}</span>
              </div>
            ))}

            {popup && (
              <div
                className="comment-popup absolute z-50 bg-surface border border-border p-3 shadow-2xl flex flex-col gap-3 min-w-[240px]"
                style={{
                  left: `${popup.x}%`,
                  top: `${popup.y}%`,
                  borderRadius: "2px",
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
                  data-testid="input-comment"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPopup(null)}
                    className="px-3 py-1 text-sm border border-border text-muted-foreground hover:border-accent hover:text-foreground"
                    data-testid="btn-cancel-comment"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleSaveComment}
                    className="px-3 py-1 text-sm border border-accent bg-accent text-background hover:opacity-90"
                    data-testid="btn-save-comment"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="w-[280px] shrink-0 border-l border-border bg-surface flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="tracking-widest uppercase text-sm">COMMENTS</h2>
            <span className="text-muted-foreground text-sm">{comments.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.map((comment, idx) => (
              <div
                key={comment.id}
                className={`p-3 border-l-2 cursor-pointer interactive-element border border-border ${
                  comment.resolved 
                    ? "opacity-50 border-l-[#444444] bg-background/50" 
                    : "border-l-accent bg-background"
                } ${
                  activeCommentId === comment.id ? "ring-1 ring-border" : ""
                }`}
                onClick={() => setActiveCommentId(comment.id)}
                data-testid={`card-${comment.id}`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={`w-5 h-5 shrink-0 flex items-center justify-center text-xs ${
                    comment.resolved ? "bg-[#444444] text-gray-300" : "bg-accent text-background"
                  }`}
                  style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 25% 100%, 0 75%)" }}
                  >
                    {idx + 1}
                  </span>
                  <p className={`text-sm ${comment.resolved ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {comment.text}
                  </p>
                </div>
                
                {!comment.resolved && (
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        resolveComment.mutate({ id: comment.id });
                      }}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-2 py-1 interactive-element hover:border-accent hover:text-accent"
                      data-testid={`btn-resolve-${comment.id}`}
                    >
                      RESOLVE
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {comments.length === 0 && (
              <div className="text-muted-foreground text-sm text-center py-8">
                NO COMMENTS YET
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border shrink-0">
            <button
              onClick={copyForClaude}
              className="w-full py-3 border border-border text-sm uppercase tracking-wider interactive-element hover:border-accent"
              data-testid="btn-copy-claude"
            >
              → COPY ALL FOR CLAUDE
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
