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
    const body = await req.json()
    const { plan, transactionId }: { plan: string; transactionId?: string } = body

    console.log("[API] body:", JSON.stringify(body))
    console.log("[API] env STRIPE_PRICE_BASIC:", process.env.STRIPE_PRICE_BASIC ?? "(not set)")
    console.log("[API] env STRIPE_PRICE_PRO:  ", process.env.STRIPE_PRICE_PRO   ?? "(not set)")
    console.log("[API] env STRIPE_SECRET_KEY present:", !!process.env.STRIPE_SECRET_KEY)

    // Validate plan
    if (!plan || !(plan in PRICE_MAP)) {
      throw new Error(`CHECKOUT FAILED: unknown plan "${plan}"`)
    }

    const { priceId, dbPlan } = PRICE_MAP[plan as Plan]

    if (!priceId) {
      throw new Error(`CHECKOUT FAILED: env var not set for plan "${plan}" — set STRIPE_PRICE_BASIC / STRIPE_PRICE_PRO in Vercel`)
    }

    console.log("[API] resolved priceId:", priceId)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mexguardian.com"

    const metadata: Record<string, string> = { plan: dbPlan }
    if (transactionId) metadata.transaction_id = transactionId

    console.log("[STRIPE] creating session with priceId:", priceId)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      success_url: `${baseUrl}/transaction/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/start`,
    })

    console.log("[STRIPE] session id:", session.id)
    console.log("[STRIPE] session.url:", session.url ?? "(null)")
    console.log("[STRIPE] payment_status:", session.payment_status)

    if (!session.url) {
      throw new Error("CHECKOUT FAILED: Stripe returned a session but session.url is null")
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[checkout] EXCEPTION:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creating checkout" },
      { status: 500 }
    )
  }
}
