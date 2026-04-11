"use client";

import { useState } from "react";

const PLAN_TO_PRICE: Record<"49" | "79", string> = {
  "49": "price_1TKnooBgMSWbEFIIv0Pg5V1P",
  "79": "price_1TKnpHBgMSWbEFIIbmJUc4C7",
};

interface CheckoutButtonProps {
  plan: "49" | "79";
  className?: string;
  children: React.ReactNode;
}

export function CheckoutButton({ plan, className, children }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: PLAN_TO_PRICE[plan] }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error ?? "No checkout URL returned");
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
