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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const isLocalhost =
      baseUrl.includes("localhost") ||
      baseUrl.includes("127.0.0.1");
    if (!baseUrl || (!baseUrl.startsWith("https://") && !isLocalhost)) {
      throw new Error("INVALID NEXT_PUBLIC_BASE_URL");
    }

    const adminDb = createAdminClient();

    // ── Test plan (internal only, $10 MXN) ─────────────────────────────────
    if (plan === "test") {
      console.log("[checkout] creating transaction");
      const { data: testTx, error: testTxErr } = await adminDb
        .from("transactions")
        .insert({ plan: "test", status: "pending" })
        .select("id")
        .single();
      console.log("[checkout] result:", testTx, testTxErr);
      if (testTxErr || !testTx?.id) {
        console.error("[checkout] FAILED TO CREATE TRANSACTION", testTxErr);
        return new Response(
          JSON.stringify({ error: "TRANSACTION_CREATION_FAILED" }),
          { status: 500 }
        );
      }

      console.log("[checkout] using transaction_id:", testTx.id);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price: process.env.STRIPE_PRICE_TEST_MXN,
            quantity: 1,
          },
        ],

        metadata: {
          transaction_id: testTx.id,
          plan: "test",
          is_upgrade: "false",
        },

        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/transaction/${testTx.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}`,
      });
      console.log("[checkout] test session created", { id: session.id, transaction_id: testTx.id });
      return NextResponse.json({ url: session.url });
    }

    if (plan !== "39" && plan !== "69") {
      throw new Error(`INVALID PLAN: ${plan}`);
    }

    const validPlan = plan as Plan;
    const isUpgrade = validPlan === "69" && !!transaction_id;

    // ── Currency resolution ─────────────────────────────────────────────────
    // For upgrades, ALWAYS inherit the currency of the original paid session.
    // This guarantees the user cannot end up with a cross-currency transaction.
    let currency: Currency;

    if (isUpgrade) {
      const inherited = await inheritCurrencyFromTransaction(transaction_id!);
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

    // ── Payment method composition ──────────────────────────────────────────
    const isMx = stripeCurrency === "mxn";
    const payment_method_types = (
      isMx ? ["card", "oxxo"] : ["card"]
    ) as ("card" | "oxxo")[];

    const payment_method_options = isMx
      ? { oxxo: { expires_after_days: 3 } }
      : undefined;

    // ── Resolve transaction ID ──────────────────────────────────────────────
    // For upgrades: reuse the existing transaction row.
    // For new purchases: create a pending row before Stripe so the ID is known.
    let resolvedTransactionId: string;

    if (isUpgrade) {
      resolvedTransactionId = transaction_id!;
    } else {
      console.log("[checkout] creating transaction");
      const { data: tx, error } = await adminDb
        .from("transactions")
        .insert({ plan: validPlan, status: "pending" })
        .select("id")
        .single();
      console.log("[checkout] result:", tx, error);
      if (error || !tx?.id) {
        console.error("[checkout] FAILED TO CREATE TRANSACTION", error);
        return new Response(
          JSON.stringify({ error: "TRANSACTION_CREATION_FAILED" }),
          { status: 500 }
        );
      }
      resolvedTransactionId = tx.id;
    }

    // ── Metadata ────────────────────────────────────────────────────────────
    const metadata: Record<string, string> = {
      plan: validPlan,
      currency: stripeCurrency,
      transaction_id: resolvedTransactionId,
      is_upgrade: isUpgrade ? "true" : "false",
    };

    // ── Session params ──────────────────────────────────────────────────────
    const params: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "payment",
      payment_method_types,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      success_url: `${baseUrl}/transaction/${resolvedTransactionId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isUpgrade
        ? `${baseUrl}/transaction/${resolvedTransactionId}`
        : `${baseUrl}/#pricing`,
    };

    if (payment_method_options) {
      params.payment_method_options = payment_method_options;
    }

    console.log("[checkout] using transaction_id:", resolvedTransactionId);
    const session = await stripe.checkout.sessions.create(params);
    console.log("SESSION CREATED FULL:", session);

    console.log("[checkout] session created", {
      id: session.id,
      plan: validPlan,
      currency: stripeCurrency,
      transaction_id: resolvedTransactionId,
      is_upgrade: isUpgrade,
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
