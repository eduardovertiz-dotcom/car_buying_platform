import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
})

const PRICE_TO_PLAN: Record<string, "49" | "79"> = {
  "price_1TKnooBgMSWbEFIIv0Pg5V1P": "49",
  "price_1TKnpHBgMSWbEFIIbmJUc4C7": "79",
  "price_1TKtx4BgMSWbEFIIdUeEhJn0": "79",
}

export async function POST(req: Request) {
  try {
    const { priceId, transactionId } = await req.json()

    const plan = PRICE_TO_PLAN[priceId] ?? null
    if (!plan) {
      console.error("[checkout] unknown priceId:", priceId)
      return NextResponse.json({ error: "Invalid price ID" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mexguardian.com"

    // Build metadata — include transaction_id when upgrading an existing transaction
    const metadata: Record<string, string> = { plan }
    if (transactionId) metadata.transaction_id = transactionId

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${baseUrl}/transaction/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/start`,
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