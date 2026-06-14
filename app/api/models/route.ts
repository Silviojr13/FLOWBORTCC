import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    models: ["gemma-4-31b-it", "gemma-4-26b-a4b-it"],
    connected: true,
  });
}