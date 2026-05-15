import React, { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePrototype,
  useListPrototypes,
  useDeletePrototype,
  getListPrototypesQueryKey
} from "@workspace/api-client-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const createPrototype = useCreatePrototype();
  const deletePrototype = useDeletePrototype();
  const { data: prototypes } = useListPrototypes();

  const handleUpload = async () => {
    if (!file || !projectName.trim()) return;
    const text = await file.text();
    createPrototype.mutate(
      { data: { htmlContent: text, fileName: file.name, projectName: projectName.trim() } },
      {
        onSuccess: (prototype) => {
          setLocation(`/view/${prototype.id}`);
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

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePrototype.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPrototypesQueryKey() });
          setDeleteConfirmId(null);
        }
      }
    );
  };

  const handleShare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = window.location.origin + "/view/" + id;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground p-8 font-mono">
      <div className="w-full max-w-5xl flex flex-col h-full grow">
        <header className="mb-16 flex justify-between items-end border-b border-border pb-4">
          <h1 className="text-xl font-normal lowercase tracking-widest text-foreground">framelink</h1>
          <div className="text-muted-foreground uppercase tracking-wider text-sm">
            {prototypes ? `// ${prototypes.length} PROTOTYPES` : ""}
          </div>
        </header>

        <main className="flex-grow flex flex-col items-center justify-start w-full gap-16">
          {/* Upload Section */}
          <div className="w-full max-w-3xl flex flex-col gap-4">
            <div className="flex gap-4 items-stretch h-32">
              <div className="flex-1 flex flex-col justify-end">
                <label className="mb-2 text-muted-foreground uppercase tracking-widest text-sm">PROJECT NAME</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full h-16 bg-transparent border-2 border-border text-foreground px-4 outline-none focus:border-accent interactive-element transition-colors"
                  placeholder="e.g. Acme Dashboard"
                  data-testid="input-project-name"
                />
              </div>

              <div
                className={`flex-1 h-32 flex flex-col items-center justify-center border-2 border-dashed relative cursor-pointer interactive-element transition-colors ${
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
                  {file ? file.name : "DROP HTML FILE"}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleUpload}
              disabled={!file || !projectName.trim() || createPrototype.isPending}
              className="w-full h-16 bg-accent text-background font-bold tracking-widest uppercase disabled:opacity-50 interactive-element hover:opacity-90 transition-opacity"
              data-testid="btn-upload"
            >
              {createPrototype.isPending ? "UPLOADING..." : "→ UPLOAD"}
            </button>
          </div>

          {/* List Section */}
          <div className="w-full">
            {prototypes && prototypes.length > 0 && (
              <div className="flex flex-col border-t border-border">
                {prototypes.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap md:flex-nowrap justify-between items-center py-4 px-4 border-b border-border border-l-2 border-l-transparent hover:border-l-accent bg-background transition-colors interactive-element group"
                    data-testid={`row-prototype-${p.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-grow min-w-0 mr-4">
                      <span className="font-bold text-accent truncate">{p.projectName}</span>
                      <span className="text-muted-foreground truncate hidden sm:inline">|</span>
                      <span className="text-muted-foreground truncate">{p.fileName}</span>
                      <span className="text-muted-foreground truncate hidden sm:inline">|</span>
                      <span className="text-muted-foreground text-sm">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mt-4 md:mt-0">
                      <button
                        onClick={() => setLocation(`/view/${p.id}`)}
                        className="text-sm tracking-widest uppercase hover:text-accent interactive-element"
                        data-testid={`btn-open-${p.id}`}
                      >
                        → OPEN
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
                            <span className="text-muted-foreground uppercase mr-2">DELETE {p.projectName}?</span>
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
