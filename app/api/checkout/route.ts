import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveCurrency,
  toStripeCurrency,
  type Currency,
} from "@/lib/currency";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type Plan = "39" | "69";

function priceIdFor(plan: Plan, currency: Currency): string | undefined {
  if (plan === "39") {
    if (currency === "USD") return process.env.STRIPE_PRICE_BASIC_USD?.trim();
    if (currency === "CAD") return process.env.STRIPE_PRICE_BASIC_CAD?.trim();
    if (currency === "MXN") return process.env.STRIPE_PRICE_BASIC_MXN?.trim();
  }
  if (plan === "69") {
    if (currency === "USD") return process.env.STRIPE_PRICE_PRO_USD?.trim();
    if (currency === "CAD") return process.env.STRIPE_PRICE_PRO_CAD?.trim();
    if (currency === "MXN") return process.env.STRIPE_PRICE_PRO_MXN?.trim();
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, transaction_id, currency: bodyCurrency } = body as {
      plan?: string;
      transaction_id?: string;
      currency?: string;
    };

    if (plan !== "39" && plan !== "69") {
      throw new Error(`INVALID PLAN: ${plan}`);
    }

    const validPlan = plan as Plan;

    // ── Currency resolution ─────────────────────────────────────────────────
    // For upgrades, ALWAYS inherit the currency of the original paid session.
    // This guarantees the user cannot end up with a cross-currency transaction.
    let currency: Currency;

    if (validPlan === "69" && transaction_id) {
      const inherited = await inheritCurrencyFromTransaction(transaction_id);
      if (inherited) {
        currency = inherited;
      } else {
        // First-time upgrade path with no prior Stripe session recorded
        // (e.g. dev-mode transactions) — fall through to resolver.
        currency = resolveCurrency(
          bodyCurrency ?? null,
          req.headers.get("x-vercel-ip-country")
        );
      }
    } else {
      currency = resolveCurrency(
        bodyCurrency ?? null,
        req.headers.get("x-vercel-ip-country")
      );
    }

    const stripeCurrency = toStripeCurrency(currency);

    // ── Price ID lookup ─────────────────────────────────────────────────────
    const priceId = priceIdFor(validPlan, currency);
    console.log("[checkout] price lookup", {
      plan: validPlan,
      currency,
      priceId: priceId ?? "MISSING",
      envKey: `STRIPE_PRICE_${validPlan === "39" ? "BASIC" : "PRO"}_${currency}`,
    });
    if (!priceId) {
      throw new Error(
        `MISSING STRIPE PRICE ID for plan=${validPlan} currency=${currency}`
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl || !baseUrl.startsWith("https://")) {
      throw new Error("INVALID NEXT_PUBLIC_BASE_URL");
    }

    // ── Payment method composition ──────────────────────────────────────────
    // OXXO and SPEI (customer_balance + mx_bank_transfer) are MXN-only on
    // Stripe. Including them under any other currency triggers a Stripe error.
    const isMx = stripeCurrency === "mxn";
    const payment_method_types = (
      isMx ? ["card", "oxxo"] : ["card"]
    ) as ("card" | "oxxo")[];

    const payment_method_options = isMx
      ? { oxxo: { expires_after_days: 3 } }
      : undefined;

    // ── Metadata (preserved for webhook + post-checkout) ────────────────────
    const metadata: Record<string, string> = {
      plan: validPlan,
      currency: stripeCurrency,
    };
    if (transaction_id) metadata.transaction_id = transaction_id;

    // ── Session params ──────────────────────────────────────────────────────
    const params: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "payment",
      payment_method_types,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      success_url: `${baseUrl}/api/post-checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: transaction_id
        ? `${baseUrl}/transaction/${transaction_id}`
        : `${baseUrl}/#pricing`,
    };

    if (payment_method_options) {
      params.payment_method_options = payment_method_options;
    }


    const session = await stripe.checkout.sessions.create(params);

    console.log("[checkout] session created", {
      id: session.id,
      plan: validPlan,
      currency: stripeCurrency,
      transaction_id: transaction_id ?? null,
      methods: payment_method_types,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(
      "[checkout] EXCEPTION:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creating checkout" },
      { status: 500 }
    );
  }
}

/**
 * For upgrade sessions: look up the original paid Stripe session by id via the
 * transactions row, and return its locked currency. Returns null if the row
 * has no linked Stripe session (e.g. dev-mode transactions).
 */
async function inheritCurrencyFromTransaction(
  transactionId: string
): Promise<Currency | null> {
  try {
    const adminDb = createAdminClient();
    const { data } = await adminDb
      .from("transactions")
      .select("stripe_session_id")
      .eq("id", transactionId)
      .maybeSingle();

    const sid = data?.stripe_session_id as string | undefined;
    if (!sid) return null;

    const prior = await stripe.checkout.sessions.retrieve(sid);
    const priorCurrency = (prior.currency ?? "").toUpperCase();
    if (priorCurrency === "USD" || priorCurrency === "CAD" || priorCurrency === "MXN") {
      return priorCurrency;
    }
    return null;
  } catch (err) {
    console.warn(
      "[checkout] inheritCurrencyFromTransaction failed, falling through:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
