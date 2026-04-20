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
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "#0F0F0F" }}
    >
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8">
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
            Mex<span style={{ color: "#B4531A" }}>Guardian</span>
          </span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>
          Access your MexGuardian record
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 32 }}>
          Sign in to save and access your verified transactions.
        </p>

        {/* Primary: Google */}
        <button
          onClick={handleGoogle}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "#B4531A",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "13px 20px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            transition: "opacity .15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.10)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.10)" }} />
        </div>

        {/* Secondary: Email */}
        {sent ? (
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", textAlign: "center" }}>
            Check your email for a secure sign-in link.
          </p>
        ) : (
          <>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#fff",
                fontSize: 14,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 10,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")}
            />
            <button
              onClick={handleMagicLink}
              style={{
                width: "100%",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(255,255,255,0.55)",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 20px",
                borderRadius: 10,
                background: "transparent",
                cursor: "pointer",
                transition: "border-color .15s, color .15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                e.currentTarget.style.color = "rgba(255,255,255,0.55)";
              }}
            >
              Use email instead
            </button>
          </>
        )}

        {/* Legal */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
          By continuing, you agree to our{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "underline" }}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
