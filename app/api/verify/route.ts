import { NextResponse } from "next/server";

export async function POST() {
  console.log("VERIFY MOCK USED");
  return NextResponse.json({
    status: "mock_complete",
    risk_level: "moderate",
    confidence: 0.4,
    message: "Verification not yet available. Using preliminary analysis.",
  });
}
