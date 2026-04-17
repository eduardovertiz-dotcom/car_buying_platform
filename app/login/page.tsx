"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.1 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.09 5.51C12.5 13.67 17.8 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.67c-.55 2.98-2.22 5.5-4.72 7.2l7.26 5.64C43.28 37.3 46.5 31.38 46.5 24.5z"/>
      <path fill="#FBBC05" d="M10.73 28.27A14.54 14.54 0 019.5 24c0-1.49.26-2.93.73-4.27L3.14 14.22A23.94 23.94 0 001 24c0 3.88.93 7.54 2.57 10.78l7.16-6.51z"/>
      <path fill="#34A853" d="M24 47c5.5 0 10.11-1.82 13.48-4.94l-7.26-5.64c-1.83 1.23-4.17 1.95-6.22 1.95-6.2 0-11.5-4.17-13.27-9.73l-7.16 6.51C7.07 42.52 14.82 47 24 47z"/>
      <path fill="none" d="M1 1h46v46H1z"/>
    </svg>
  );
}

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

        {/* Primary: Google */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 bg-[var(--accent)] text-white text-sm font-medium px-5 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--foreground-muted)] opacity-60">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Secondary: Email */}
        {sent ? (
          <p className="text-sm text-white/70 text-center">
            Check your email for a secure sign-in link.
          </p>
        ) : (
          <>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border border-[var(--border)] text-white text-sm rounded-lg px-4 py-3 mb-3 placeholder:text-[var(--foreground-muted)] focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleMagicLink}
              className="w-full border border-[var(--border)] text-[var(--foreground-muted)] text-sm font-medium px-5 py-3 rounded-lg hover:border-white/30 hover:text-white transition-colors"
            >
              Use email instead
            </button>
          </>
        )}

        {/* Legal */}
        <p className="text-xs text-[var(--foreground-muted)] opacity-50 text-center mt-6 leading-relaxed">
          By continuing, you agree to our{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80 transition-opacity"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-80 transition-opacity"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
