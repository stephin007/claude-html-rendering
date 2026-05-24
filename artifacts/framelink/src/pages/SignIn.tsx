import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuthContext } from "@/context/AuthContext";
import { useTitle } from "@/hooks/useTitle";
import { op } from "@/lib/analytics";

export default function SignIn() {
  useTitle("Sign in");
  const [, setLocation] = useLocation();
  const { refetch } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      op.identify({ profileId: data.id, email: data.email });
      op.track("user_login", { method: "email" });
      await refetch();
      setLocation("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-8 font-mono">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Link href="/" className="text-xl lowercase tracking-widest text-foreground hover:text-accent transition-colors">
            framelink
          </Link>
          <div className="border-b border-border" />
          <h1 className="text-sm uppercase tracking-widest text-muted-foreground mt-4">
            // SIGN IN
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full h-12 bg-transparent border border-border text-foreground px-4 outline-none focus:border-accent transition-colors font-mono text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 bg-transparent border border-border text-foreground px-4 outline-none focus:border-accent transition-colors font-mono text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs uppercase tracking-widest">
              // {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-accent text-background font-bold tracking-widest uppercase disabled:opacity-50 hover:opacity-90 transition-opacity mt-2"
          >
            {loading ? "SIGNING IN..." : "→ SIGN IN"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          NO ACCOUNT?{" "}
          <Link href="/sign-up" className="text-accent hover:underline">
            SIGN UP →
          </Link>
        </p>
      </div>
    </div>
  );
}
