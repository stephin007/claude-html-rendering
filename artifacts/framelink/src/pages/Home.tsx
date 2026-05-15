import React, { useCallback, useState } from "react";
import { useLocation } from "wouter";
import {
  useCreatePrototype,
  useListPrototypes,
} from "@workspace/api-client-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  
  const createPrototype = useCreatePrototype();
  const { data: prototypes } = useListPrototypes();

  const handleFile = async (file: File) => {
    if (!file) return;
    const text = await file.text();
    createPrototype.mutate(
      { data: { htmlContent: text, fileName: file.name } },
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
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [createPrototype, setLocation]
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground p-8 font-mono">
      <div className="w-full max-w-4xl flex flex-col h-full grow">
        <header className="mb-24">
          <h1 className="text-xl font-normal lowercase tracking-widest text-foreground">framelink</h1>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center w-full">
          <div
            className={`w-full max-w-2xl aspect-video flex items-center justify-center border-2 border-dashed relative cursor-pointer interactive-element transition-colors ${
              isDragging ? "border-accent bg-card" : "border-border"
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
            <span className="text-xl tracking-widest text-muted-foreground uppercase">
              {createPrototype.isPending ? "UPLOADING..." : "DROP HTML FILE"}
            </span>
          </div>

          <div className="mt-16 w-full max-w-2xl">
            {prototypes && prototypes.length > 0 && (
              <div className="space-y-4">
                {prototypes.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center py-3 border-b border-border interactive-element cursor-pointer group"
                    onClick={() => setLocation(`/view/${p.id}`)}
                    data-testid={`link-prototype-${p.id}`}
                  >
                    <span className="text-muted-foreground group-hover:text-foreground group-active:text-background transition-colors">{p.fileName}</span>
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
