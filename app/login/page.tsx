"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleGoogle() {
    const redirect = new URLSearchParams(window.location.search).get("redirect") ?? "";
    const callbackUrl = redirect
      ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
      : `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  }

  async function handleMagicLink() {
    if (!email) return;
    const redirect = new URLSearchParams(window.location.search).get("redirect") ?? "";
    const callbackUrl = redirect
      ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`
      : `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-white mb-2">
          Access your MexGuardian record
        </h1>
        <p className="text-sm text-[var(--foreground-muted)] mb-8">
          Sign in to save and access your verified transactions.
        </p>

        <button
          onClick={handleGoogle}
          className="w-full bg-white text-gray-900 text-sm font-medium px-5 py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          Continue with Google
        </button>
        <p className="text-xs text-[var(--foreground-muted)] text-center mt-2 mb-6">
          Secure login powered by Google
        </p>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--foreground-muted)]">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {sent ? (
          <p className="text-sm text-white/70 text-center">
            Check your email for a secure sign-in link.
          </p>
        ) : (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border border-[var(--border)] text-white text-sm rounded-lg px-4 py-3 mb-3 placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleMagicLink}
              className="w-full bg-[var(--accent)] text-white text-sm font-medium px-5 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Send secure link
            </button>
          </>
        )}
      </div>
    </main>
  );
}
