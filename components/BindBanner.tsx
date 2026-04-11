"use client";

import { useEffect, useState } from "react";

interface Props {
  transactionId: string;
  hasOwner: boolean;
}

export default function BindBanner({ transactionId, hasOwner }: Props) {
  const [bound, setBound] = useState(false);
  const [loading, setLoading] = useState(true);

  // On mount: if we're returning from login with a pending bind, execute it
  useEffect(() => {
    const pending = localStorage.getItem("bind_pending");
    if (!pending || pending !== transactionId) {
      setLoading(false);
      return;
    }

    fetch("/api/bind-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: pending }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          localStorage.removeItem("bind_pending");
          setBound(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [transactionId]);

  function handleBind() {
    localStorage.setItem("bind_pending", transactionId);
    window.location.href = "/login";
  }

  // Already owned, just bound, or bind is in progress — nothing to show
  if (hasOwner || loading) return null;

  if (bound) {
    return (
      <div className="mb-6 px-4 py-3 bg-green-900/30 border border-green-700/40 rounded-lg">
        <p className="text-sm text-green-300">
          Saved. You can now access this from any device.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 px-4 py-3 bg-white/5 border border-[var(--border)] rounded-lg flex items-center justify-between gap-4">
      <p className="text-sm text-white/70">
        This transaction isn&apos;t saved to any account.
      </p>
      <button
        onClick={handleBind}
        className="text-sm text-white underline shrink-0 hover:opacity-80 transition-opacity"
      >
        Save to your account →
      </button>
    </div>
  );
}
