import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
})

const PRICE_TO_PLAN: Record<string, "49" | "79"> = {
  "price_1TKnooBgMSWbEFIIv0Pg5V1P": "49",
  "price_1TKnpHBgMSWbEFIIbmJUc4C7": "79",
}

export async function POST(req: Request) {
  try {
    const { priceId } = await req.json()

    const plan = PRICE_TO_PLAN[priceId] ?? null
    if (!plan) {
      console.error("[checkout] unknown priceId:", priceId)
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 })
    }

    // Derive base URL from request origin — works correctly on Vercel, local, and preview deployments
    // Falls back to NEXT_PUBLIC_BASE_URL if origin header is absent
    const origin = req.headers.get("origin")
    const baseUrl = origin ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
    console.log("[checkout] baseUrl:", baseUrl)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: { plan },
      success_url: `${baseUrl}/transaction/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}`,
    })

    console.log("[checkout] session.url:", session.url)

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Error creating checkout" },
      { status: 500 }
    )
  }
}