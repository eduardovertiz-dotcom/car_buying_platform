"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

interface Props {
  transactionId: string;
  hasOwner: boolean;
}

export default function BindBanner({ transactionId, hasOwner }: Props) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  const [bound, setBound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bindError, setBindError] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);

  // On mount: if we're returning from login with a pending bind, execute it.
  // Users are always authenticated by the time they reach this page.
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

  // Direct bind — called when authenticated user clicks "Save to your account".
  // No login redirect needed: auth is enforced at the page level.
  async function handleBind() {
    setBinding(true);
    setBindError(null);

    try {
      const res = await fetch("/api/bind-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });

      if (res.ok) {
        setBound(true);
        return;
      }

      if (res.status === 403) {
        // Check if the transaction is already bound to the current user
        // (race condition: another tab or device completed the bind first)
        const supabase = createClient();
        const { data: tx } = await supabase
          .from("transactions")
          .select("id")
          .eq("id", transactionId)
          .single();

        if (tx) {
          // Accessible via RLS → already owned by this user
          setBound(true);
        } else {
          // Not accessible → email mismatch with a different account
          setBindError(
            "This transaction is linked to a different email. Please sign in with the email used at checkout."
          );
        }
        return;
      }

      // Other errors — fail silently, don't block the page
      console.error("BIND BANNER: unexpected status", res.status);
    } catch {
      console.error("BIND BANNER: network error");
    } finally {
      setBinding(false);
    }
  }

  // Already owned, just bound, or bind is in progress — nothing to show
  if (hasOwner || loading) return null;

  if (bound) {
    return (
      <div className="mb-6 px-4 py-3 bg-green-900/30 border border-green-700/40 rounded-lg">
        <p className="text-sm text-green-300">
          {t.bind.saved}
        </p>
      </div>
    );
  }

  if (bindError) {
    return (
      <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-700/40 rounded-lg">
        <p className="text-sm text-red-400">{t.bind.differentEmail}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 px-4 py-3 bg-white/5 border border-[var(--border)] rounded-lg flex items-center justify-between gap-4">
      <p className="text-sm text-white/70">
        {t.bind.notSaved}
      </p>
      <button
        onClick={handleBind}
        disabled={binding}
        className="text-sm text-white underline shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40"
      >
        {binding ? t.bind.saving : t.bind.saveToAccount}
      </button>
    </div>
  );
}
