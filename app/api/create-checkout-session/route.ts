import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLANS: Record<string, { name: string; amount: number }> = {
  "49": { name: "MexGuardian Report", amount: 4900 },
  "79": { name: "MexGuardian Report + Verification", amount: 7900 },
};

export async function POST(req: NextRequest) {
  const { plan } = await req.json();

  const product = PLANS[plan];
  if (!product) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: product.name },
          unit_amount: product.amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/cancel`,
    metadata: { plan },
  });

  return NextResponse.json({ url: session.url });
}
