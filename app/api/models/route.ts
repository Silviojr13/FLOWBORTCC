import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"],
    connected: true,
  });
}