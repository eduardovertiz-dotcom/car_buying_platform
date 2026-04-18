import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { plan, transaction_id } = await req.json();

    console.log("[checkout]", { plan, transaction_id });

    if (plan !== "39" && plan !== "69") {
      throw new Error(`INVALID PLAN: ${plan}`);
    }

    const validPlan = plan as "39" | "69";

    const PRICE_MAP: Record<"39" | "69", number> = {
      "39": 3900,
      "69": 6900,
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl || !baseUrl.startsWith("https://")) {
      throw new Error("INVALID NEXT_PUBLIC_BASE_URL");
    }

    const metadata: Record<string, string> = { plan };
    if (transaction_id) metadata.transaction_id = transaction_id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: validPlan === "69" ? "Full Protection" : "Basic Report",
            },
            unit_amount: PRICE_MAP[validPlan],
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${baseUrl}/api/post-checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: transaction_id
        ? `${baseUrl}/transaction/${transaction_id}`
        : `${baseUrl}/#pricing`,
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
