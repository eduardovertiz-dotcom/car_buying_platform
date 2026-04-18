import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { plan } = await req.json();

    console.log("CHECKOUT API HIT", { plan });

    if (plan !== "39" && plan !== "69") {
      throw new Error(`INVALID PLAN: ${plan}`);
    }

    const PRICE_MAP: Record<"39" | "69", number> = {
      "39": 3900,
      "69": 6900,
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl || !baseUrl.startsWith("https://")) {
      throw new Error("INVALID NEXT_PUBLIC_BASE_URL");
    }

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
      cancel_url: `${baseUrl}/#pricing`,
    });

    console.log("STRIPE SESSION CREATED", session.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] EXCEPTION:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creating checkout" },
      { status: 500 }
    );
  }
}
