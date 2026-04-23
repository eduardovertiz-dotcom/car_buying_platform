import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transaction_id, plate } = body as {
      transaction_id?: string;
      plate?: string;
    };

    if (!transaction_id || !plate) {
      return NextResponse.json(
        { success: false, error: "Missing transaction_id or plate" },
        { status: 400 }
      );
    }

    const adminDb = createAdminClient();

    // Validate transaction exists and is paid
    const { data: tx, error: txError } = await adminDb
      .from("transactions")
      .select("status")
      .eq("id", transaction_id)
      .single();

    if (txError || !tx) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (tx.status !== "paid") {
      return NextResponse.json(
        { success: false, error: "Transaction is not paid" },
        { status: 400 }
      );
    }

    // Call Verifik API
    const url = `https://api.verifik.co/v2/mx/vehiculo/placa/${plate}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.VERIFIK_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    const text = await res.text();
    
    console.log("🚗 VERIFIK RAW RESPONSE:", text);
    console.log("🚗 VERIFIK STATUS:", res.status);
    
    let verifikData;
    try {
      verifikData = JSON.parse(text);
    } catch {
      console.error("❌ VERIFIK NOT JSON");
      throw new Error("Verifik response is not JSON");
    }

    // Save the result in the transaction record
    const { error: updateError } = await adminDb
      .from("transactions")
      .update({ verification_result: verifikData })
      .eq("id", transaction_id);

    if (updateError) {
      console.error("Failed to update transaction with verification_result", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to save verification result" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: verifikData,
    });
  } catch (error) {
    console.error("Verify API Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
