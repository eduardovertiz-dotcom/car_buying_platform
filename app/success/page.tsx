import Link from "next/link";

interface SessionData {
  id: string;
  customer_email: string | null;
  amount_total: number | null;
  metadata: { plan?: string } | null;
}

async function getSession(sessionId: string): Promise<SessionData | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/get-session?session_id=${sessionId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-[var(--foreground-muted)]">No session ID found.</p>
        <Link href="/" className="text-sm text-[var(--foreground-muted)] hover:text-white mt-4 inline-block">
          ← Back to home
        </Link>
      </main>
    );
  }

  const session = await getSession(sessionId);

  if (!session) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-[var(--foreground-muted)]">Could not load session details.</p>
        <Link href="/" className="text-sm text-[var(--foreground-muted)] hover:text-white mt-4 inline-block">
          ← Back to home
        </Link>
      </main>
    );
  }

  const amountFormatted =
    session.amount_total != null
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : "—";

  const planLabel =
    session.metadata?.plan === "79"
      ? "MexGuardian Report + Verification"
      : "MexGuardian Report";

  return (
    <main className="max-w-xl mx-auto px-6 py-24">

      <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">Payment confirmed</p>

      <h1 className="text-3xl font-semibold text-white leading-tight mb-8">
        You&apos;re verified.<br />
        Check your email for details.
      </h1>

      <div className="flex flex-col gap-3 mb-10">
        <div className="flex justify-between text-sm border-b border-white/[0.06] pb-3">
          <span className="text-[var(--foreground-muted)]">Email</span>
          <span className="text-white">{session.customer_email ?? "—"}</span>
        </div>
        <div className="flex justify-between text-sm border-b border-white/[0.06] pb-3">
          <span className="text-[var(--foreground-muted)]">Plan</span>
          <span className="text-white">{planLabel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--foreground-muted)]">Amount paid</span>
          <span className="text-white">{amountFormatted}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href={`/factura?txn=${session.id}`}
          className="inline-flex items-center justify-center gap-2 bg-white/[0.06] text-white text-sm font-medium rounded-lg px-5 py-3 hover:bg-white/[0.10] transition-colors"
        >
          ¿Necesitas factura?
        </Link>
        <Link
          href="/transactions"
          className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg px-5 py-3 hover:opacity-90 transition-opacity"
        >
          Go to my transaction →
        </Link>
      </div>

    </main>
  );
}
