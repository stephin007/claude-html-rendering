import { useState, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProject,
  useCreatePrototype,
  useDeletePrototype,
  getGetProjectQueryKey
} from "@workspace/api-client-react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { data: project } = useGetProject(id as string, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id as string) },
  });

  const createPrototype = useCreatePrototype();
  const deletePrototype = useDeletePrototype();

  const handleUpload = async () => {
    if (!file || !id) return;
    const text = await file.text();
    
    createPrototype.mutate(
      { data: { htmlContent: text, fileName: file.name, projectId: id } },
      {
        onSuccess: () => {
          setFile(null);
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

          {/* List Section */}
          <div className="w-full">
            {project.prototypes && project.prototypes.length > 0 ? (
              <div className="flex flex-col border-t border-border">
                {project.prototypes.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap md:flex-nowrap justify-between items-center py-4 px-4 border-b border-border border-l-2 border-l-transparent hover:border-l-accent bg-background transition-colors interactive-element group"
                    data-testid={`row-prototype-${p.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-grow min-w-0 mr-4">
                      <span className="font-bold text-accent truncate">{p.fileName}</span>
                      <span className="text-muted-foreground truncate hidden sm:inline">|</span>
                      <span className="text-muted-foreground text-sm">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mt-4 md:mt-0">
                      <button
                        onClick={() => setLocation(`/view/${p.id}`)}
                        className="text-sm tracking-widest uppercase hover:text-accent interactive-element"
                        data-testid={`btn-review-${p.id}`}
                      >
                        → REVIEW
                      </button>
                      
                      <button
                        onClick={(e) => handleShare(p.id, e)}
                        className="text-sm tracking-widest uppercase hover:text-accent interactive-element w-24 text-left"
                        data-testid={`btn-share-${p.id}`}
                      >
                        {copiedId === p.id ? "// COPIED" : "→ SHARE"}
                      </button>

                      <div className="w-48 text-right">
                        {deleteConfirmId === p.id ? (
                          <div className="flex items-center justify-end gap-2 text-sm">
                            <span className="text-muted-foreground uppercase mr-2">DELETE {p.fileName}?</span>
                            <button
                              onClick={(e) => handleDelete(p.id, e)}
                              className="text-accent hover:underline font-bold"
                              data-testid={`btn-confirm-delete-${p.id}`}
                            >
                              Y
                            </button>
                            <span className="text-muted-foreground">/</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(null);
                              }}
                              className="text-foreground hover:underline"
                            >
                              N
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(p.id);
                            }}
                            className="text-sm tracking-widest uppercase text-muted-foreground hover:text-red-500 interactive-element"
                            data-testid={`btn-delete-${p.id}`}
                          >
                            ✕ DELETE
                          </button>
                        )}
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
