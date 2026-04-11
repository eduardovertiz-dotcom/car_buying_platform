"use client";

import { useState } from "react";

interface CheckoutButtonProps {
  plan: "49" | "79";
  className?: string;
  children: React.ReactNode;
}

export function CheckoutButton({ plan, className, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    console.log(`[checkout] initiating plan=${plan}`);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "No checkout URL returned");
      console.log(`[checkout] redirecting to Stripe`);
      window.location.href = url;
    } catch (err) {
      console.error("[checkout] failed:", err);
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {loading ? "Redirecting…" : children}
    </button>
  );
}
