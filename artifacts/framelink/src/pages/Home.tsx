import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useTitle } from "@/hooks/useTitle";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects,
  useCreateProject,
  useCreatePrototype,
  useDeleteProject,
  useUpdateProject,
  getListProjectsQueryKey
} from "@workspace/api-client-react";
import { useAuthContext } from "@/context/AuthContext";

export default function Home() {
  useTitle(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuthContext();
  const [isDragging, setIsDragging] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const createProject = useCreateProject();
  const createPrototype = useCreatePrototype();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const { data: projects } = useListProjects();

  const handleUpload = async () => {
    if (!file || !projectName.trim()) return;
    const text = await file.text();
    
    createProject.mutate(
      { data: { name: projectName.trim() } },
      {
        onSuccess: (project) => {
          createPrototype.mutate(
            { data: { htmlContent: text, fileName: file.name, projectId: project.id } },
            {
              onSuccess: () => {
                setLocation(`/project/${project.id}`);
              },
            }
          );
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
    deleteProject.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setDeleteConfirmId(null);
        }
      }
    );
  };

  const startEditing = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(currentName);
    setTimeout(() => editInputRef.current?.select(), 0);
  };

  const commitRename = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === projects?.find((p) => p.id === id)?.name) {
      setEditingId(null);
      return;
    }
    queryClient.setQueryData(getListProjectsQueryKey(), (old: typeof projects) =>
      old?.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
    );
    setEditingId(null);
    updateProject.mutate(
      { id, data: { name: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        },
      }
    );
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const isUploading = createProject.isPending || createPrototype.isPending;

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground p-8 font-mono">
      <div className="w-full max-w-5xl flex flex-col h-full grow">
        <header className="mb-16 flex justify-between items-end border-b border-border pb-4">
          <h1 className="text-xl font-normal lowercase tracking-widest text-foreground">framelink</h1>
          <div className="flex items-center gap-6">
            <span className="text-muted-foreground uppercase tracking-wider text-sm hidden sm:block">
              {projects ? `// ${projects.length} PROJECTS` : ""}
            </span>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground truncate max-w-[160px] hidden md:block">{user.email}</span>
                <button
                  onClick={async () => { await signOut(); }}
                  className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  SIGN OUT
                </button>
              </div>
            )}
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
              disabled={!file || !projectName.trim() || isUploading}
              className="w-full h-16 bg-accent text-background font-bold tracking-widest uppercase disabled:opacity-50 interactive-element hover:opacity-90 transition-opacity"
              data-testid="btn-upload"
            >
              {isUploading ? "UPLOADING..." : "→ UPLOAD"}
            </button>
          </div>

          {/* List Section */}
          <div className="w-full">
            {projects && projects.length > 0 && (
              <div className="flex flex-col border-t border-border">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap md:flex-nowrap justify-between items-center py-4 px-4 border-b border-border border-l-2 border-l-transparent hover:border-l-accent bg-background transition-colors interactive-element group"
                    data-testid={`row-project-${p.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-grow min-w-0 mr-4">
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
                          className="font-bold text-accent bg-transparent border-b-2 border-accent outline-none min-w-0 w-full max-w-xs"
                          data-testid={`input-rename-project-${p.id}`}
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={(e) => startEditing(p.id, p.name, e)}
                          className="font-bold text-accent truncate hover:underline underline-offset-2 text-left"
                          title="Click to rename"
                          data-testid={`btn-rename-project-${p.id}`}
                        >
                          {p.name}
                        </button>
                      )}
                      <span className="text-muted-foreground truncate hidden sm:inline">|</span>
                      <span className="text-muted-foreground truncate">// {p.fileCount} FILES</span>
                      <span className="text-muted-foreground truncate hidden sm:inline">|</span>
                      <span className="text-muted-foreground text-sm">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mt-4 md:mt-0">
                      <button
                        onClick={() => setLocation(`/project/${p.id}`)}
                        className="text-sm tracking-widest uppercase hover:text-accent interactive-element"
                        data-testid={`btn-open-${p.id}`}
                      >
                        → OPEN
                      </button>

                      <div className="w-48 text-right">
                        {deleteConfirmId === p.id ? (
                          <div className="flex items-center justify-end gap-2 text-sm">
                            <span className="text-muted-foreground uppercase mr-2">DELETE {p.name}?</span>
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
