"use client";

/**
 * NextPendingButton
 *
 * Shown inside AdminVerifyPanel after successful submission.
 * Fetches the next pending transaction and navigates to it.
 *
 * Props:
 *   currentId   — excluded from "next" query
 *   autoRedirect — if true, triggers automatically on mount (post-submit)
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type FetchState = "idle" | "loading" | "done" | "empty" | "error";

type Props = {
  currentId: string;
  autoRedirect: boolean;
};

export default function NextPendingButton({ currentId, autoRedirect }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FetchState>(autoRedirect ? "loading" : "idle");
  const didAutoFetch = useRef(false);

  async function fetchNext(): Promise<void> {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/next-pending?exclude=${currentId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id } = await res.json();
      if (!id) {
        setState("empty");
        return;
      }
      setState("done");
      router.push(`/transaction/${id}`);
    } catch {
      setState("error");
    }
  }

  // Auto-trigger once on mount if autoRedirect is true
  useEffect(() => {
    if (autoRedirect && !didAutoFetch.current) {
      didAutoFetch.current = true;
      fetchNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "empty") {
    return (
      <p className="text-sm text-[var(--foreground-muted)] mt-4">
        All caught up 🎉
      </p>
    );
  }

  if (state === "error") {
    return (
      <div className="mt-4 flex items-center gap-3">
        <p className="text-xs text-red-400">Could not fetch next case.</p>
        <button
          onClick={fetchNext}
          className="text-xs text-[var(--accent)] hover:text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const isNavigating = state === "loading" || state === "done";

  return (
    <button
      id="next-pending-btn"
      onClick={fetchNext}
      disabled={isNavigating}
      className={`mt-4 text-sm font-medium transition-colors ${
        isNavigating
          ? "text-[var(--foreground-muted)] cursor-default"
          : "text-[var(--accent)] hover:text-white"
      }`}
    >
      {isNavigating ? "Loading…" : "Next Pending →"}
    </button>
  );
}
