import { Link } from "wouter";
import { useTitle } from "@/hooks/useTitle";

export default function Landing() {
  useTitle(null);
  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-background text-foreground p-8 font-mono">
      <div className="w-full max-w-5xl flex flex-col h-full grow">
        <header className="mb-16 flex justify-between items-end border-b border-border pb-4">
          <h1 className="text-xl font-normal lowercase tracking-widest text-foreground">
            framelink
          </h1>
          <div className="flex items-center gap-6">
            <Link
              href="/sign-in"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
            >
              SIGN IN
            </Link>
            <Link
              href="/sign-up"
              className="text-sm uppercase tracking-widest bg-accent text-background px-4 py-2 hover:opacity-90 transition-opacity"
            >
              → GET STARTED
            </Link>
          </div>
        </header>

        <main className="flex-grow flex flex-col justify-center max-w-2xl gap-12">
          <div className="flex flex-col gap-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              // HTML PROTOTYPE REVIEW
            </p>
            <h2 className="text-4xl font-normal leading-tight tracking-tight">
              Upload. Share.{" "}
              <span className="text-accent">
                Comment directly on the design.
              </span>
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Drop any HTML file, get a shareable link, and pin numbered
              comments directly onto the rendered prototype — like Figma
              comments, but for raw HTML files.
            </p>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-8">
            <div className="flex flex-col gap-6">
              {[
                [
                  "01",
                  "Upload an HTML file",
                  "Drag-and-drop or click to select. No size limit on feedback, just on your sanity.",
                ],
                [
                  "02",
                  "Get a shareable link",
                  "Every prototype gets a public UUID link — share it with anyone.",
                ],
                [
                  "03",
                  "Pin comments on the design",
                  "Click anywhere on the rendered prototype to drop a numbered bubble. Resolve or delete anytime.",
                ],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-6">
                  <span className="text-accent text-sm shrink-0 mt-0.5">
                    {num}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm uppercase tracking-widest">
                      {title}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      {desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/sign-up"
            className="self-start h-14 px-8 bg-accent text-background font-bold tracking-widest uppercase flex items-center hover:opacity-90 transition-opacity"
          >
            → START FOR FREE
          </Link>
        </main>
      </div>
    </div>
  );
}
