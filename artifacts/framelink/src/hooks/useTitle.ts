import { useEffect } from "react";

export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) {
      document.title = "Framelink";
      return;
    }
    document.title = `${title} — Framelink`;
    return () => {
      document.title = "Framelink";
    };
  }, [title]);
}
