"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FacturaForm from "@/components/FacturaForm";
import { createClient } from "@/lib/supabase/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function TransactionsPage() {
  const router = useRouter();
  const [loaded, setLoaded]           = useState(false);
  const [newId, setNewId]             = useState<string | null>(null);
  const [newEmail, setNewEmail]       = useState<string | null>(null);
  const [isFacturaOpen, setFactura]   = useState(false);
  const [bindError, setBindError]     = useState<string | null>(null);
  const facturaRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleOpenFactura() {
    setFactura(true);
    setTimeout(() => {
      facturaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  // Single effect: auth guard → bind → query → route
  useEffect(() => {
    const supabase = createClient();
    const params   = new URLSearchParams(window.location.search);
    const newParam = params.get("new");

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      // ── Unauthenticated ───────────────────────────────────────────────────
      if (!user) {
        if (newParam) {
          try { localStorage.setItem("bind_pending", newParam); } catch {}
        }
        router.replace(
          "/login?redirect=" + encodeURIComponent(window.location.pathname + window.location.search)
        );
        return;
      }

      // ── Execute any pending bind ──────────────────────────────────────────
      const pendingBind = localStorage.getItem("bind_pending");
      if (pendingBind) {
        const res = await fetch("/api/bind-transaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: pendingBind }),
        });
        localStorage.removeItem("bind_pending");
        if (!res.ok && res.status === 403) {
          setBindError(
            "This transaction is linked to a different email. Sign in with the email address used at checkout."
          );
        }
      }

      // ── Query: most recent paid transaction owned by this user ────────────
      // Ownership = user_id match OR email match (case-insensitive).
      // No user_id IS NULL constraint — covers both bound and unbound states.
      const userEmail = (user.email ?? "").toLowerCase().trim();
      const orFilter  = userEmail
        ? `user_id.eq.${user.id},email.ilike.${userEmail}`
        : `user_id.eq.${user.id}`;

      const { data, error } = await supabase
        .from("transactions")
        .select("id, email, status, created_at")
        .or(orFilter)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[TX_STATE] query error:", error);
        setLoaded(true);
        return;
      }

      // ── Post-payment confirmation screen (?new=<uuid>) ────────────────────
      // Stay on this page so the user can see confirmation + request a factura.
      // The ?new id is the freshly created transaction.
      if (newParam && UUID_RE.test(newParam)) {
        setNewId(newParam);
        // Prefetch the transaction email for the factura form using the auth'd client
        setNewEmail(data?.email ?? null);
        setLoaded(true);
        return;
      }

      // ── Returning user: redirect immediately to their transaction ─────────
      if (data?.id && UUID_RE.test(data.id)) {
        router.replace(`/transaction/${data.id}`);
        return;
      }

      // ── No paid transaction found — show empty state ──────────────────────
      setLoaded(true);
    });
  }, [router]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-[680px] mx-auto">

        {/* ── Post-payment confirmation (?new present) ── */}
        {newId && (
          <div className="min-h-[65vh] flex flex-col justify-center">
            <div className="max-w-[560px] mx-auto px-6">
              <p className="text-xs tracking-[0.2em] uppercase text-white/70">
                Payment confirmed
              </p>

              <div className="mt-3 space-y-3">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Your verification is ready
                </h2>
                <p className="text-sm text-[var(--foreground-muted)]">
                  Payment received successfully.
                </p>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed opacity-70">
                  Your transaction has been created. Begin the verification process when you&apos;re ready.
                </p>
              </div>

              <div className="mt-8">
                {bindError ? (
                  <div className="space-y-3">
                    <p className="text-sm text-red-400">{bindError}</p>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-white/60 underline hover:text-white transition-colors"
                    >
                      Sign out and try a different account
                    </button>
                  </div>
                ) : (
                  <Link
                    href={`/transaction/${newId}`}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-6 py-3.5 hover:opacity-90 transition-opacity"
                  >
                    Start verification →
                  </Link>
                )}
              </div>

              <div className="mt-6">
                {!isFacturaOpen && (
                  <button
                    onClick={handleOpenFactura}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Request invoice (Factura)
                  </button>
                )}
                {isFacturaOpen && (
                  <div ref={facturaRef}>
                    <FacturaForm transactionId={newId} prefillEmail={newEmail} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state (no ?new, no paid transaction found) ── */}
        {!newId && loaded && (
          <>
            <div className="mb-10 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight">
                  MexGuardian
                </h1>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Your active transactions
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="text-sm text-[var(--foreground-muted)] hover:text-white transition-colors"
                >
                  Sign out
                </button>
                <Link
                  href="/start"
                  className="shrink-0 bg-[var(--accent)] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                >
                  + Start new
                </Link>
              </div>
            </div>

            <div className="text-center mt-20">
              <h2 className="text-lg font-semibold text-white mb-2">
                No transactions yet
              </h2>
              <p className="text-sm text-[var(--foreground-muted)] mb-6">
                Start your first vehicle verification
              </p>
              <Link
                href="/start"
                className="inline-flex items-center gap-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
              >
                Start new transaction →
              </Link>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
