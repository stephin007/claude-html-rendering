import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject,
  useCreatePrototype,
  useDeletePrototype,
  useUpdatePrototype,
  getGetProjectQueryKey
} from "@workspace/api-client-react";
import { useTitle } from "@/hooks/useTitle";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Map of prototypeId → timestamp when it was added as pending.
  // Entries are removed when the thumbnail resolves OR after THUMBNAIL_TIMEOUT_MS.
  const [pendingThumbnailIds, setPendingThumbnailIds] = useState<Map<string, number>>(new Map());
  const THUMBNAIL_TIMEOUT_MS = 30_000;
  
  const { data: project, refetch } = useGetProject(id as string, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id as string) },
  });

  // Remove IDs from pending map once their thumbnail resolves OR they time out
  useEffect(() => {
    if (!project?.prototypes || pendingThumbnailIds.size === 0) return;
    const now = Date.now();
    const toRemove = [...pendingThumbnailIds.keys()].filter((pid) => {
      const proto = project.prototypes?.find((p) => p.id === pid);
      const addedAt = pendingThumbnailIds.get(pid) ?? 0;
      return (proto && proto.thumbnail != null) || (now - addedAt > THUMBNAIL_TIMEOUT_MS);
    });
    if (toRemove.length === 0) return;
    setPendingThumbnailIds((prev) => {
      const next = new Map(prev);
      toRemove.forEach((rid) => next.delete(rid));
      return next;
    });
  }, [project, pendingThumbnailIds]);

  // Poll only while we have locally-tracked pending uploads
  useEffect(() => {
    if (pendingThumbnailIds.size === 0) return;
    const timer = setInterval(() => { void refetch(); }, 3000);
    return () => clearInterval(timer);
  }, [pendingThumbnailIds.size, refetch]);

  useTitle(project?.name ?? null);

  const createPrototype = useCreatePrototype();
  const deletePrototype = useDeletePrototype();
  const updatePrototype = useUpdatePrototype();

  const handleUpload = async () => {
    if (!file || !id) return;
    const text = await file.text();
    
    createPrototype.mutate(
      { data: { htmlContent: text, fileName: file.name, projectId: id } },
      {
        onSuccess: (data) => {
          setFile(null);
          // Track this new prototype as pending a thumbnail (with timestamp for timeout)
          setPendingThumbnailIds((prev) => new Map([...prev, [data.id, Date.now()]]));
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
        },
      }
    );
  };

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        setFile(droppedFile);
      }
    },
    []
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleDelete = (prototypeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePrototype.mutate(
      { id: prototypeId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id as string) });
          setDeleteConfirmId(null);
        }
      }
    );
  };

  const handleShare = (prototypeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.origin + "/view/" + prototypeId;
    navigator.clipboard.writeText(url);
    setCopiedId(prototypeId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditing = (protoId: string, currentName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(protoId);
    setEditingName(currentName);
    setTimeout(() => editInputRef.current?.select(), 0);
  };

  const commitRename = (protoId: string) => {
    const trimmed = editingName.trim();
    const currentName = project?.prototypes?.find((p) => p.id === protoId)?.fileName;
    if (!trimmed || trimmed === currentName) {
      setEditingId(null);
      return;
    }
    queryClient.setQueryData(getGetProjectQueryKey(id as string), (old: typeof project) => {
      if (!old) return old;
      return {
        ...old,
        prototypes: old.prototypes.map((p) =>
          p.id === protoId ? { ...p, fileName: trimmed } : p
        ),
      };
    });
    setEditingId(null);
    updatePrototype.mutate(
      { id: protoId, data: { fileName: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id as string) });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id as string) });
        },
      }
    );
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  if (!project) return <div className="p-8 font-mono">LOADING...</div>;

  const isUploading = createPrototype.isPending;

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground p-8 font-mono">
      <div className="w-full max-w-5xl flex flex-col h-full grow">
        <header className="mb-16 flex justify-between items-end border-b border-border pb-4">
          <Link href="/" className="text-xl font-normal lowercase tracking-widest text-foreground hover:text-accent interactive-element transition-colors">
            framelink
          </Link>
          <div className="font-bold text-lg uppercase tracking-widest text-foreground">
            {project.name}
          </div>
          <div className="text-muted-foreground uppercase tracking-wider text-sm">
            // {project.prototypes?.length || 0} FILES
          </div>
        </header>

        <main className="flex-grow flex flex-col items-center justify-start w-full gap-16">
          {/* Upload Section */}
          <div className="w-full max-w-3xl flex flex-col gap-4">
            <div
              className={`w-full h-32 flex flex-col items-center justify-center border-2 border-dashed relative cursor-pointer interactive-element transition-colors ${
                isDragging ? "border-accent bg-card" : file ? "border-accent" : "border-border"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              data-testid="upload-zone"
            >
              <input
                type="file"
                accept=".html"
                onChange={onChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="input-file"
              />
              <span className="text-sm tracking-widest text-muted-foreground uppercase text-center px-4">
                {file ? file.name : "DROP HTML FILE TO ADD TO PROJECT"}
              </span>
            </div>
            
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full h-16 bg-accent text-background font-bold tracking-widest uppercase disabled:opacity-50 interactive-element hover:opacity-90 transition-opacity"
              data-testid="btn-upload"
            >
              {isUploading ? "UPLOADING..." : "→ UPLOAD"}
            </button>
          </div>

          {/* Prototype card grid */}
          <div className="w-full">
            {project.prototypes && project.prototypes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px border border-border">
                {project.prototypes.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col bg-background group"
                    data-testid={`row-prototype-${p.id}`}
                  >
                    {/* Thumbnail */}
                    <Link href={`/view/${p.id}`} className="block" data-testid={`link-prototype-${p.id}`}>
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt={p.fileName}
                          className="w-full h-36 object-cover object-top border-b border-border"
                        />
                      ) : (
                        <div className="w-full h-36 border-b border-border bg-card flex items-center justify-center">
                          <span className="text-xs text-muted-foreground uppercase tracking-widest text-center px-4">
                            {pendingThumbnailIds.has(p.id) ? "// GENERATING..." : p.fileName}
                          </span>
                        </div>
                      )}
                    </Link>

                    {/* Info + actions */}
                    <div className="flex flex-col gap-3 p-3 flex-1">
                      <div className="flex flex-col gap-1 min-w-0">
                        {editingId === p.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => commitRename(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(p.id);
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="font-bold text-accent bg-transparent border-b-2 border-accent outline-none min-w-0 w-full text-sm"
                            data-testid={`input-rename-prototype-${p.id}`}
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={(e) => startEditing(p.id, p.fileName, e)}
                            className="font-bold text-accent truncate hover:underline underline-offset-2 text-sm text-left"
                            title="Click to rename"
                            data-testid={`btn-rename-prototype-${p.id}`}
                          >
                            {p.fileName}
                          </button>
                        )}
                        <span className="text-muted-foreground text-xs">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border">
                        <button
                          onClick={() => setLocation(`/view/${p.id}`)}
                          className="text-xs tracking-widest uppercase hover:text-accent interactive-element"
                          data-testid={`btn-review-${p.id}`}
                        >
                          → REVIEW
                        </button>

                        <button
                          onClick={(e) => handleShare(p.id, e)}
                          className="text-xs tracking-widest uppercase hover:text-accent interactive-element w-20 text-left"
                          data-testid={`btn-share-${p.id}`}
                        >
                          {copiedId === p.id ? "// COPIED" : "→ SHARE"}
                        </button>

                        <div className="ml-auto">
                          {deleteConfirmId === p.id ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground uppercase">DELETE?</span>
                              <button
                                onClick={(e) => handleDelete(p.id, e)}
                                className="text-accent hover:underline font-bold"
                                data-testid={`btn-confirm-delete-${p.id}`}
                              >
                                Y
                              </button>
                              <span className="text-muted-foreground">/</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                                className="text-foreground hover:underline"
                              >
                                N
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                              className="text-xs tracking-widest uppercase text-muted-foreground hover:text-red-500 interactive-element"
                              data-testid={`btn-delete-${p.id}`}
                            >
                              ✕ DELETE
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground uppercase tracking-widest text-sm py-16">
                // NO FILES YET — DROP ONE ABOVE
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
