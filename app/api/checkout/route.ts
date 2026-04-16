import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
})

type Plan = "basic" | "pro"

// Price IDs live server-side only — the frontend never sees them.
// Set STRIPE_PRICE_BASIC and STRIPE_PRICE_PRO in your environment.
const PRICE_MAP: Record<Plan, { priceId: string; dbPlan: "49" | "79" }> = {
  basic: {
    priceId: process.env.STRIPE_PRICE_BASIC ?? "",
    dbPlan:  "49",
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    dbPlan:  "79",
  },
}

export async function POST(req: Request) {
  try {
    const { plan, transactionId }: { plan: string; transactionId?: string } = await req.json()

    console.log("[checkout] plan:", plan)

    // Validate plan
    if (!plan || !(plan in PRICE_MAP)) {
      console.error("[checkout] unknown plan:", plan)
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const { priceId, dbPlan } = PRICE_MAP[plan as Plan]

    // Fail loudly if the env var is not set rather than sending an empty price ID to Stripe
    if (!priceId) {
      console.error("[checkout] priceId not configured for plan:", plan)
      return NextResponse.json({ error: "Plan not configured on server" }, { status: 500 })
    }

    console.log("[checkout] resolved priceId:", priceId)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mexguardian.com"

    // dbPlan goes into Stripe metadata so the success page / webhook can store it in DB.
    // transactionId is only present when upgrading an existing transaction.
    const metadata: Record<string, string> = { plan: dbPlan }
    if (transactionId) metadata.transaction_id = transactionId

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      success_url: `${baseUrl}/transaction/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/start`,
    })

    if (!session.url) {
      throw new Error("Missing Stripe session URL")
    }

    console.log("[checkout] session.url:", session.url)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[checkout] error:", err)
    return NextResponse.json({ error: "Error creating checkout" }, { status: 500 })
  }
}
