/** GET /api/intents/status?depositAddress=…  →  { status } of a 1-Click swap. */
import { type NextRequest, NextResponse } from "next/server";

import { oneClick } from "@/lib/oneClick";

export async function GET(request: NextRequest) {
  const depositAddress = request.nextUrl.searchParams.get("depositAddress");
  if (!depositAddress) return NextResponse.json({ error: "depositAddress is required" }, { status: 400 });
  try {
    const { status } = await oneClick<{ status: string }>(
      `/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`,
    );
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 502 });
  }
}
