import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { plan } = await req.json();

    console.log("[checkout] plan:", plan);

    const PRICE_MAP: Record<string, number> = {
      "39": 3900,
      "69": 6900,
    };

    if (!PRICE_MAP[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const rawBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!rawBaseUrl) {
      throw new Error("[checkout] NEXT_PUBLIC_BASE_URL is not set");
    }

    // Normalize: env var may be stored without scheme (e.g. "mexguardian.com")
    const baseUrl = rawBaseUrl.startsWith("http") ? rawBaseUrl : `https://${rawBaseUrl}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan === "69" ? "Full Protection" : "Basic Report",
            },
            unit_amount: PRICE_MAP[plan],
          },
          quantity: 1,
        },
      ],
      metadata: { plan },
      success_url: `${baseUrl}/api/post-checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
    });

    console.log("[checkout] session created:", session.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] EXCEPTION:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creating checkout" },
      { status: 500 }
    );
  }
}
